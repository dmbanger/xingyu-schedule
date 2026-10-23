// 把 version.properties 里的版本号写成前端可读的 version.js，
// 这样设置页 / 关于页会自动跟随版本，不用手改。
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const props = fs.readFileSync(path.join(root, 'version.properties'), 'utf8');
const name = (props.match(/versionName\s*=\s*(\S+)/) || [])[1] || '0.0.0';
const code = (props.match(/versionCode\s*=\s*(\d+)/) || [])[1] || '0';
const out = 'window.AppVersion=' + JSON.stringify(name) + ';window.AppVersionCode=' + JSON.stringify(code) + ';\n';
fs.writeFileSync(path.join(root, 'app/src/main/assets/version.js'), out, 'utf8');
console.log('Generated version.js ' + name + ' (code ' + code + ')');
