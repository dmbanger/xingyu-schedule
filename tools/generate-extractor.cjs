const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../app/src/main/assets');
fs.writeFileSync(path.join(dir,'extract.js'),require(path.join(dir,'core.js')).snapshotScript(),'utf8');
console.log('Generated school table extractor');
