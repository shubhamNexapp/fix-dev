const fs = require('fs')
const moment = require('moment')

//For log purpose. if error or success. 
exports.LogFileData = (params, error_type) => {
    var date = new Date();
    var final_date = moment(date).format("DD/MM/YYYY h:mm:ss a");


    fs.appendFile('./content/logFile/log.txt', final_date + '\n' + error_type + '\n' + params + '\n\n', function (params) {
        if (params) throw params;
        console.log('Saved!');
    });

}
