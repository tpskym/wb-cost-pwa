// Build on macOS; CI publishes this native installer alongside the web application.
import {mkdtemp,copyFile,rm,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
if(process.platform!=='darwin')throw Error('macOS installer must be built on macOS');
const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'workshop-mac-build-'));
try{
 const staging=join(temp,'Workshop-macOS');await mkdir(staging);
 const app=join(staging,'Установка Мастерской.app');
 execFileSync('/usr/bin/osacompile',['-o',app,join(root,'macos-helper/Installer.applescript')]);
 // Compile the URL handler too to catch AppleScript syntax errors before distributing it.
 execFileSync('/bin/sh',[join(root,'macos-helper/build-helper.sh'),join(temp,'Helper.app')]);
 const scheme=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleURLTypes:0:CFBundleURLSchemes:0',join(temp,'Helper.app/Contents/Info.plist')],{encoding:'utf8'}).trim();if(scheme!=='workshop-files')throw Error('Missing URL handler');
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',join(temp,'Helper.app')]);
 const architectures=execFileSync('/usr/bin/lipo',['-archs',join(temp,'Helper.app/Contents/MacOS/applet')],{encoding:'utf8'});if(!architectures.includes('arm64')||!architectures.includes('x86_64'))throw Error('Universal Mac helper required');
 for(const name of ['Helper.applescript','open-file.sh','webdav-check.sh','build-helper.sh'])await copyFile(join(root,'macos-helper',name),join(app,'Contents/Resources',name));
 await copyFile(join(root,'macos-helper/README.txt'),join(staging,'README.txt'));
 execFileSync('/usr/libexec/PlistBuddy',['-c','Add :CFBundleIdentifier string io.github.tpskym.workshop.installer',join(app,'Contents/Info.plist')]);
 execFileSync('/usr/bin/codesign',['--force','--sign','-',app]);
 execFileSync('/usr/bin/ditto',['-c','-k','--sequesterRsrc','--keepParent',staging,join(root,'workshop-macos.zip')]);
}finally{await rm(temp,{recursive:true,force:true});}
