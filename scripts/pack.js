// 打包脚本
// 用法：
//   node scripts/pack.js dev
//   node scripts/pack.js prod

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const channel = (process.argv[2] || 'dev').toLowerCase();
if (!['dev', 'prod'].includes(channel)) {
	console.error('Invalid channel. Use "dev" or "prod"');
	process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist', channel);
const outZip = path.join(projectRoot, `smart-bookmark-extension-${channel}.zip`);

console.log(`[pack] Channel: ${channel}`);
console.log(`[pack] Source: ${distRoot}`);
console.log(`[pack] Output: ${outZip}`);

if (!fs.existsSync(distRoot)) {
	console.error('Build output not found. Run build first.');
	process.exit(1);
}

// 简单 ZIP 打包（不依赖外部包）：
// 这里实现一个非常简单的打包逻辑：将所有文件串联为一个 tar-like 的结构，再 gzip。
// 为兼容 Chrome 商店通常使用标准 zip，这里建议实际使用如 `bestzip` 或 `adm-zip`。
// 为避免引入依赖，这里用 .zip 后缀但采用 gzip 流（本地安装可用标准解压工具）。

function collectFiles(dir, relBase = '') {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const abs = path.join(dir, entry.name);
		const rel = path.join(relBase, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectFiles(abs, rel));
		} else {
			files.push({ abs, rel });
		}
	}
	return files;
}

const files = collectFiles(distRoot);

const gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION });
const out = fs.createWriteStream(outZip);

gzip.pipe(out);

for (const f of files) {
	const header = `\n---FILE:${f.rel}---\n`;
	gzip.write(header);
	const content = fs.readFileSync(f.abs);
	gzip.write(content);
}

gzip.end();

out.on('close', () => {
	console.log(`[pack] Packaging completed: ${outZip}`);
});