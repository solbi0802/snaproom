import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const source = path.resolve('src')
const issues = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { await walk(file); continue }
    const relative = path.relative(source, file).replaceAll('\\', '/')
    if (!/\.(css|tsx)$/.test(file)) continue
    const text = await readFile(file, 'utf8')
    if (file.endsWith('.css') && relative !== 'shared/styles/tokens.css' && /#[\da-f]{3,8}\b|\b(?:rgb|hsl)a?\(/i.test(text)) {
      issues.push(`${relative}: UI 색상은 shared/styles/tokens.css의 의미 토큰을 사용하세요.`)
    }
    if (file.endsWith('.tsx') && !relative.startsWith('shared/ui/') && /<button\b/.test(text)) {
      issues.push(`${relative}: 공통 Button 또는 IconButton을 사용하세요.`)
    }
  }
}
await walk(source)
if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1 }
else console.log('UI 규칙 확인: 색상 토큰과 공통 버튼 사용 통과')
