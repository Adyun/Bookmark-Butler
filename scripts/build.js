// 构建脚本（支持 dev / prod 渠道）
// 用法：
//   node scripts/build.js dev
//   node scripts/build.js prod

const fs = require('fs');
const path = require('path');

const channel = (process.argv[2] || 'dev').toLowerCase();
if (!['dev', 'prod'].includes(channel)) {
	console.error('Invalid channel. Use "dev" or "prod"');
	process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');
const outDir = path.join(distRoot, channel);

console.log(`[build] Channel: ${channel}`);

// 清理输出目录
function removeDirSync(dir) {
	if (!fs.existsSync(dir)) return;
	for (const entry of fs.readdirSync(dir)) {
		const p = path.join(dir, entry);
		const stat = fs.lstatSync(p);
		if (stat.isDirectory()) {
			removeDirSync(p);
		} else {
			fs.unlinkSync(p);
		}
	}
	fs.rmdirSync(dir);
}

function ensureDirSync(dir) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 需要排除的路径（仅在 prod 渠道）
const prodExcludes = new Set([
	'docs',
	'tests'
]);

// 需要排除的文件名（仅在 prod 渠道）
const prodExcludeFiles = [
	// 顶层测试页面
	'test-animation-preview.html',
	'test-breadcrumb.html'
];

// 需要排除的后缀（仅在 prod 渠道）
const prodExcludeExtensions = new Set([
	'.md'
]);

function shouldExclude(relPath) {
	if (channel !== 'prod') return false;
	const normalized = relPath.replace(/\\/g, '/');
	const parts = normalized.split('/');
	// 目录排除
	if (parts.some(p => prodExcludes.has(p))) return true;
	// 文件名排除
	const base = path.basename(relPath);
	if (prodExcludeFiles.includes(base)) return true;
	// 扩展名排除
	const ext = path.extname(base).toLowerCase();
	if (prodExcludeExtensions.has(ext)) return true;
	return false;
}

// 去除 console.* 的简单处理（仅在 prod 渠道）
function stripConsole(content, filePath) {
	if (channel !== 'prod') return content;
	if (!filePath.endsWith('.js')) return content;
	// 尽量安全地移除单行 console 调用（log/debug/info/warn/error）
	// 注意：对多行模板字符串中的 console 可能无能为力，这里以简单可靠为主
	const lines = content.split(/\r?\n/);
	const filtered = lines.filter(line => !/\bconsole\s*\.(log|debug|info|warn|error)\s*\(/.test(line));
	return filtered.join('\n');
}

function copyRecursive(srcDir, destDir, relBase = '') {
	ensureDirSync(destDir);
	const entries = fs.readdirSync(srcDir, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(srcDir, entry.name);
		const relPath = path.join(relBase, entry.name);
		const destPath = path.join(destDir, entry.name);

		if (shouldExclude(relPath)) {
			continue;
		}

		if (entry.isDirectory()) {
			copyRecursive(srcPath, destPath, relPath);
			continue;
		}

		if (entry.name === 'manifest.json') {
			const manifest = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
			if (channel === 'dev') {
				manifest.name = (manifest.name || 'Smart Bookmark Extension') + ' (Dev)';
				manifest.version_name = (manifest.version || '1.0.0') + '-dev';
			} else {
				manifest.name = (manifest.name || 'Smart Bookmark Extension').replace(/\s*\(Dev\)$/i, '');
				if (manifest.version_name) delete manifest.version_name;
			}
			fs.writeFileSync(destPath, JSON.stringify(manifest, null, 2), 'utf8');
			continue;
		}

		let content = fs.readFileSync(srcPath);
		// 仅 JS 文本进行处理
		if (/\.js$/i.test(entry.name)) {
			content = content.toString('utf8');
			content = stripConsole(content, srcPath);
			fs.writeFileSync(destPath, content, 'utf8');
		} else {
			fs.writeFileSync(destPath, content);
		}
	}
}

// 开始构建
ensureDirSync(distRoot);
removeDirSync(outDir);
ensureDirSync(outDir);

console.log(`[build] Cleaning and preparing: ${outDir}`);

copyRecursive(projectRoot, outDir);

console.log(`[build] Completed successfully: ${outDir}`);