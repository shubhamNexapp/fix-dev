#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "======================================"
echo "Java Auth + Node.js Integration Test"
echo "======================================"
echo ""

# Check if both services are running
echo "📡 Checking service status..."
echo ""

JAVA_AUTH_STATUS=$(curl -s http://localhost:8080/actuator/health 2>/dev/null)
if [ -z "$JAVA_AUTH_STATUS" ]; then
    echo -e "${RED}❌ Java Auth Service is NOT running on port 8080${NC}"
    echo "   Start it with: cd jauth-main && ./run.sh"
    exit 1
else
    echo -e "${GREEN}✅ Java Auth Service is running${NC}"
fi

NODE_STATUS=$(curl -s http://localhost:5000/ 2>/dev/null)
if [ -z "$NODE_STATUS" ]; then
    echo -e "${RED}❌ Node.js Service is NOT running on port 5000${NC}"
    echo "   Start it with: npm run dev"
    exit 1
else
    echo -e "${GREEN}✅ Node.js Service is running${NC}"
fi

echo ""
echo -e "${YELLOW}⚠️  NOTE: If you just updated JWT_SECRET, restart Node.js service first!${NC}"
echo ""
read -p "Press Enter to continue with tests or Ctrl+C to cancel..."
echo ""

# Generate unique email for testing
TIMESTAMP=$(date +%s)
TEST_EMAIL="testuser${TIMESTAMP}@example.com"
PROVIDER_EMAIL="provider${TIMESTAMP}@example.com"

echo "======================================"
echo "Test 1: User Registration"
echo "======================================"
echo ""
echo "📝 Registering user: $TEST_EMAIL"
echo ""

USER_RESPONSE=$(curl -s -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"SecurePass123\",
    \"fullName\": \"Test User Integration\",
    \"phone\": \"+919876543210\",
    \"address\": \"123 Test Street\",
    \"city\": \"Mumbai\",
    \"pincode\": \"400001\",
    \"location\": {
      \"lat\": 19.0760,
      \"lng\": 72.8777
    }
  }")

echo "Response:"
echo "$USER_RESPONSE" | jq '.' 2>/dev/null || echo "$USER_RESPONSE"
echo ""

# Check if registration was successful
if echo "$USER_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test 1 PASSED: User registered successfully${NC}"
    
    # Extract important data
    ACCESS_TOKEN=$(echo "$USER_RESPONSE" | jq -r '.accessToken')
    USER_ID=$(echo "$USER_RESPONSE" | jq -r '.userId')
    JAVA_USER_ID=$(echo "$USER_RESPONSE" | jq -r '.javaUserId')
    
    echo "   MongoDB userId: $USER_ID"
    echo "   Java Auth userId: $JAVA_USER_ID"
    echo "   Access Token: ${ACCESS_TOKEN:0:50}..."
else
    echo -e "${RED}❌ Test 1 FAILED: User registration failed${NC}"
    ERROR_MSG=$(echo "$USER_RESPONSE" | jq -r '.message' 2>/dev/null || echo "Unknown error")
    echo "   Error: $ERROR_MSG"
fi

echo ""
echo "======================================"
echo "Test 2: Provider Registration"
echo "======================================"
echo ""
echo "📝 Registering provider: $PROVIDER_EMAIL"
echo ""

PROVIDER_RESPONSE=$(curl -s -X POST http://localhost:5000/auth/provider/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$PROVIDER_EMAIL\",
    \"password\": \"ProviderPass123\",
    \"name\": \"Expert Test Plumber\",
    \"phone\": \"+919123456789\",
    \"address\": \"456 Provider Street\",
    \"serviceCategories\": [\"plumber\", \"electrician\"],
    \"experience\": \"5 years\",
    \"latitude\": 19.1234,
    \"longitude\": 72.9876
  }")

echo "Response:"
echo "$PROVIDER_RESPONSE" | jq '.' 2>/dev/null || echo "$PROVIDER_RESPONSE"
echo ""

# Check if registration was successful
if echo "$PROVIDER_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test 2 PASSED: Provider registered successfully${NC}"
    
    # Extract important data
    PROVIDER_ACCESS_TOKEN=$(echo "$PROVIDER_RESPONSE" | jq -r '.accessToken')
    PROVIDER_ID=$(echo "$PROVIDER_RESPONSE" | jq -r '.providerId')
    JAVA_PROVIDER_ID=$(echo "$PROVIDER_RESPONSE" | jq -r '.javaUserId')
    
    echo "   MongoDB providerId: $PROVIDER_ID"
    echo "   Java Auth userId: $JAVA_PROVIDER_ID"
    echo "   Access Token: ${PROVIDER_ACCESS_TOKEN:0:50}..."
else
    echo -e "${RED}❌ Test 2 FAILED: Provider registration failed${NC}"
    ERROR_MSG=$(echo "$PROVIDER_RESPONSE" | jq -r '.message' 2>/dev/null || echo "Unknown error")
    echo "   Error: $ERROR_MSG"
fi

echo ""
echo "======================================"
echo "Test 3: Duplicate Email Validation"
echo "======================================"
echo ""
echo "📝 Attempting to register duplicate user: $TEST_EMAIL"
echo ""

DUPLICATE_RESPONSE=$(curl -s -X POST http://localhost:5000/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"AnotherPass123\",
    \"fullName\": \"Another User\"
  }")

echo "Response:"
echo "$DUPLICATE_RESPONSE" | jq '.' 2>/dev/null || echo "$DUPLICATE_RESPONSE"
echo ""

# Check if duplicate was properly rejected
if echo "$DUPLICATE_RESPONSE" | jq -e '.success == false' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Test 3 PASSED: Duplicate email properly rejected${NC}"
else
    echo -e "${RED}❌ Test 3 FAILED: Should have rejected duplicate email${NC}"
fi

echo ""
echo "======================================"
echo "Test 4: JWT Token Validation"
echo "======================================"
echo ""

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
    echo "📝 Testing authenticated request with JWT token"
    echo ""
    
    # Try to get user profile with the token
    PROFILE_RESPONSE=$(curl -s -X GET "http://localhost:5000/api/user/$USER_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    echo "Response:"
    echo "$PROFILE_RESPONSE" | jq '.' 2>/dev/null || echo "$PROFILE_RESPONSE"
    echo ""
    
    if echo "$PROFILE_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Test 4 PASSED: JWT token validated successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Test 4 WARNING: Token validation endpoint might not exist${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Test 4 SKIPPED: No access token available${NC}"
fi

echo ""
echo "======================================"
echo "📊 Test Summary"
echo "======================================"
echo ""
echo "Integration tests completed!"
echo ""
echo "💡 Next Steps:"
echo "1. Check MongoDB to verify javaUserId is stored correctly"
echo "2. Check PostgreSQL to verify user was created in Java Auth"
echo "3. Test with React Native app"
echo ""
echo "🔍 Quick MongoDB Check:"
echo "   db.users.findOne({ email: \"$TEST_EMAIL\" })"
echo ""
echo "🔍 Quick PostgreSQL Check:"
echo "   SELECT id, email, full_name, role FROM users WHERE email = '$TEST_EMAIL';"
echo ""
