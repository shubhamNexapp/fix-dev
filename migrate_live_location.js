/**
 * Migration Script for Live Location Schema Updates
 * 
 * This script safely migrates existing providers to the new live location schema
 * without losing any existing data. Run this after deploying the updated Provider model.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import the updated Provider model
const Provider = require('./models/provider');

const MIGRATION_CONFIG = {
  BATCH_SIZE: 100,
  DRY_RUN: true, // Set to false to actually perform the migration
  BACKUP_EXISTING: true
};

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for migration');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Create backup of existing data
const createBackup = async () => {
  if (!MIGRATION_CONFIG.BACKUP_EXISTING) return;
  
  try {
    console.log('💾 Creating backup of existing provider data...');
    
    const providers = await Provider.find({}).lean();
    const backupData = {
      timestamp: new Date().toISOString(),
      totalProviders: providers.length,
      providers: providers
    };
    
    const fs = require('fs');
    const backupFileName = `provider_backup_${Date.now()}.json`;
    fs.writeFileSync(backupFileName, JSON.stringify(backupData, null, 2));
    
    console.log(`✅ Backup created: ${backupFileName} (${providers.length} providers)`);
  } catch (error) {
    console.error('❌ Backup creation failed:', error);
    throw error;
  }
};

// Analyze existing provider data
const analyzeExistingData = async () => {
  try {
    console.log('🔍 Analyzing existing provider data...');
    
    const total = await Provider.countDocuments({});
    const withLocation = await Provider.countDocuments({
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null }
    });
    const withCurrentLocation = await Provider.countDocuments({
      'currentLocation.lat': { $exists: true, $ne: null }
    });
    const onlineProviders = await Provider.countDocuments({
      'isOnline': true
    });
    
    console.log('📊 Provider Data Analysis:');
    console.log(`   Total Providers: ${total}`);
    console.log(`   With Static Location: ${withLocation} (${Math.round(withLocation/total*100)}%)`);
    console.log(`   With Live Location: ${withCurrentLocation} (${Math.round(withCurrentLocation/total*100)}%)`);
    console.log(`   Currently Online: ${onlineProviders} (${Math.round(onlineProviders/total*100)}%)`);
    
    return { total, withLocation, withCurrentLocation, onlineProviders };
  } catch (error) {
    console.error('❌ Data analysis failed:', error);
    throw error;
  }
};

// Migrate providers in batches
const migrateProviders = async () => {
  try {
    console.log('🚀 Starting provider migration...');
    
    const total = await Provider.countDocuments({});
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    // Process in batches
    for (let skip = 0; skip < total; skip += MIGRATION_CONFIG.BATCH_SIZE) {
      console.log(`📦 Processing batch ${Math.floor(skip/MIGRATION_CONFIG.BATCH_SIZE) + 1}...`);
      
      const providers = await Provider.find({})
        .skip(skip)
        .limit(MIGRATION_CONFIG.BATCH_SIZE)
        .lean();
      
      for (const provider of providers) {
        try {
          processed++;
          
          // Check if provider needs migration
          const needsMigration = (
            !provider.hasOwnProperty('isOnline') ||
            !provider.hasOwnProperty('currentLocation') ||
            !provider.hasOwnProperty('locationTracking') ||
            !provider.hasOwnProperty('locationHistory')
          );
          
          if (!needsMigration) {
            console.log(`   ⏭️ Provider ${provider._id} already migrated`);
            continue;
          }
          
          const updateData = {};
          
          // Add isOnline field if missing
          if (!provider.hasOwnProperty('isOnline')) {
            updateData.isOnline = false;
            updateData.lastOnline = null;
          }
          
          // Add currentLocation field if missing
          if (!provider.hasOwnProperty('currentLocation')) {
            updateData.currentLocation = {
              lat: null,
              lng: null,
              accuracy: null,
              lastUpdated: null
            };
          }
          
          // Add locationTracking field if missing
          if (!provider.hasOwnProperty('locationTracking')) {
            updateData.locationTracking = {
              enabled: false,
              updateInterval: 30000,
              minDistance: 50
            };
          }
          
          // Add locationHistory field if missing
          if (!provider.hasOwnProperty('locationHistory')) {
            updateData.locationHistory = [];
          }
          
          // Copy static location to current location if provider has location but no current location
          if (provider.location && 
              provider.location.latitude && 
              provider.location.longitude &&
              (!provider.currentLocation || !provider.currentLocation.lat)) {
            
            updateData.currentLocation = {
              lat: provider.location.latitude,
              lng: provider.location.longitude,
              accuracy: null,
              lastUpdated: provider.location.lastUpdated || new Date()
            };
            
            console.log(`   📍 Copying static location to current location for provider ${provider._id}`);
          }
          
          if (Object.keys(updateData).length > 0) {
            if (!MIGRATION_CONFIG.DRY_RUN) {
              await Provider.findByIdAndUpdate(provider._id, updateData);
            }
            updated++;
            console.log(`   ✅ Updated provider ${provider._id} (${provider.name || 'Unnamed'})`);
          }
          
        } catch (error) {
          errors++;
          console.error(`   ❌ Error migrating provider ${provider._id}:`, error.message);
        }
      }
      
      console.log(`   📊 Batch completed: ${processed}/${total} processed, ${updated} updated, ${errors} errors`);
    }
    
    console.log('🎉 Migration completed!');
    console.log(`   Total Processed: ${processed}`);
    console.log(`   Successfully Updated: ${updated}`);
    console.log(`   Errors: ${errors}`);
    
    return { processed, updated, errors };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Validate migration results
const validateMigration = async () => {
  try {
    console.log('🔍 Validating migration results...');
    
    const total = await Provider.countDocuments({});
    
    // Check required fields
    const withIsOnline = await Provider.countDocuments({
      'isOnline': { $exists: true }
    });
    
    const withCurrentLocation = await Provider.countDocuments({
      'currentLocation': { $exists: true }
    });
    
    const withLocationTracking = await Provider.countDocuments({
      'locationTracking': { $exists: true }
    });
    
    const withLocationHistory = await Provider.countDocuments({
      'locationHistory': { $exists: true }
    });
    
    console.log('✅ Validation Results:');
    console.log(`   Providers with isOnline field: ${withIsOnline}/${total}`);
    console.log(`   Providers with currentLocation field: ${withCurrentLocation}/${total}`);
    console.log(`   Providers with locationTracking field: ${withLocationTracking}/${total}`);
    console.log(`   Providers with locationHistory field: ${withLocationHistory}/${total}`);
    
    const allFieldsPresent = (
      withIsOnline === total &&
      withCurrentLocation === total &&
      withLocationTracking === total &&
      withLocationHistory === total
    );
    
    if (allFieldsPresent) {
      console.log('🎉 Migration validation successful! All providers have required fields.');
    } else {
      console.log('⚠️ Migration validation found issues. Some providers may be missing required fields.');
    }
    
    return allFieldsPresent;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  }
};

// Show providers that would benefit from live location
const showLocationAnalysis = async () => {
  try {
    console.log('📍 Location Analysis for Live Location Benefits:');
    
    // Providers with static location that could use live location
    const withStaticOnly = await Provider.find({
      'location.latitude': { $exists: true, $ne: null },
      'location.longitude': { $exists: true, $ne: null },
      $or: [
        { 'currentLocation.lat': { $exists: false } },
        { 'currentLocation.lat': null }
      ]
    }).select('name email location serviceCategories').limit(10);
    
    console.log(`\n📋 Providers ready for live location (showing first 10):`);
    withStaticOnly.forEach((provider, index) => {
      console.log(`   ${index + 1}. ${provider.name || 'Unnamed'} (${provider.email})`);
      console.log(`      Services: ${provider.serviceCategories?.join(', ') || 'None'}`);
      console.log(`      Static Location: ${provider.location.latitude}, ${provider.location.longitude}`);
    });
    
    // Providers without any location
    const withoutLocation = await Provider.countDocuments({
      $or: [
        { 'location.latitude': { $exists: false } },
        { 'location.latitude': null },
        { 'location.longitude': { $exists: false } },
        { 'location.longitude': null }
      ]
    });
    
    console.log(`\n⚠️ Providers without location data: ${withoutLocation}`);
    if (withoutLocation > 0) {
      console.log('   These providers will not appear in proximity searches until they add location.');
    }
    
  } catch (error) {
    console.error('❌ Location analysis failed:', error);
  }
};

// Main migration function
const runMigration = async () => {
  try {
    console.log('🚀 Starting Live Location Schema Migration');
    console.log('============================================');
    console.log(`DRY RUN: ${MIGRATION_CONFIG.DRY_RUN ? 'YES (no changes will be made)' : 'NO (changes will be applied)'}`);
    console.log(`BATCH SIZE: ${MIGRATION_CONFIG.BATCH_SIZE}`);
    console.log(`BACKUP: ${MIGRATION_CONFIG.BACKUP_EXISTING ? 'YES' : 'NO'}`);
    console.log('');
    
    // Connect to database
    await connectDB();
    
    // Create backup if enabled
    if (MIGRATION_CONFIG.BACKUP_EXISTING) {
      await createBackup();
    }
    
    // Analyze existing data
    await analyzeExistingData();
    console.log('');
    
    // Show location analysis
    await showLocationAnalysis();
    console.log('');
    
    // Confirm migration if not dry run
    if (!MIGRATION_CONFIG.DRY_RUN) {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('⚠️ This will modify your database. Continue? (yes/no): ', resolve);
      });
      
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled by user');
        process.exit(0);
      }
    }
    
    // Perform migration
    const results = await migrateProviders();
    console.log('');
    
    // Validate results
    await validateMigration();
    console.log('');
    
    if (MIGRATION_CONFIG.DRY_RUN) {
      console.log('🔍 DRY RUN COMPLETED - No changes were made');
      console.log('💡 To perform the actual migration, set MIGRATION_CONFIG.DRY_RUN = false');
    } else {
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
      console.log('🚀 Your providers are now ready for live location tracking');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted by user');
  await mongoose.connection.close();
  process.exit(0);
});

// Usage instructions
if (process.argv.includes('--help')) {
  console.log(`
📖 Live Location Migration Script Usage:

1. DRY RUN (recommended first):
   node migrate_live_location.js

2. ACTUAL MIGRATION:
   Edit MIGRATION_CONFIG.DRY_RUN = false, then:
   node migrate_live_location.js

3. HELP:
   node migrate_live_location.js --help

Configuration Options:
- DRY_RUN: Preview changes without applying them
- BATCH_SIZE: Number of providers to process at once
- BACKUP_EXISTING: Create JSON backup before migration

The script will:
✅ Create backup of existing data
✅ Analyze current provider data structure
✅ Add missing live location fields
✅ Copy static locations to current location where appropriate
✅ Validate migration results
✅ Provide detailed progress reporting
`);
  process.exit(0);
}

// Run the migration
runMigration();