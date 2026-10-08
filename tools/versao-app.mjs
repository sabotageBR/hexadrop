/**
 * Leva a versao do package.json para o projeto iOS (MARKETING_VERSION e
 * CURRENT_PROJECT_VERSION no project.pbxproj). O Android le o package.json
 * direto no android/app/build.gradle; o Xcode nao tem como, entao o
 * `npm run ios:sync` passa por aqui.
 *
 * Mesma regra do Android: versao igual, e o numero de build e
 * maior*10000 + menor*100 + patch (1.0.15 -> 10015).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(RAIZ, 'package.json'), 'utf8'));
const [maior, menor, patch] = version.split('.').map(Number);
const build = maior * 10000 + menor * 100 + patch;
const arquivo = resolve(RAIZ, 'ios/App/App.xcodeproj/project.pbxproj');
const antes = readFileSync(arquivo, 'utf8');
const depois = antes
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
if (depois !== antes) writeFileSync(arquivo, depois);
console.log(`ios: ${version} (${build})`);
