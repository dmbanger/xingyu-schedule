const fs=require('node:fs'),path=require('node:path');
if(!process.argv[2])throw new Error('Usage: node tools/prepare-wallpaper.cjs SOURCE_PNG');
const source=path.resolve(process.argv[2]);
const output=path.join(__dirname,'../app/src/main/assets/wallpaper.png');
fs.copyFileSync(source,output);
console.log('Copied original PNG without resizing or recompression: '+output);
