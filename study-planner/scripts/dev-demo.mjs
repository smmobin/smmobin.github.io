import { spawn } from 'node:child_process'

const windows = process.platform === 'win32'
const viteCommand = windows ? (process.env.ComSpec || 'cmd.exe') : 'npm'
const viteArgs = windows
  ? ['/d', '/s', '/c', 'npm.cmd run dev -- --host 0.0.0.0']
  : ['run', 'dev', '--', '--host', '0.0.0.0']
const vite = spawn(viteCommand, viteArgs, {
  env: { ...process.env, VITE_TEST_SERVER_URL: 'http://localhost:8787' },
  stdio: 'inherit',
})
const api = spawn(process.execPath, ['server/test-server.mjs'], {
  env: { ...process.env, TEST_SERVER_PORT: '8787' },
  stdio: 'inherit',
})

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  vite.kill()
  api.kill()
  process.exitCode = code
}

vite.on('error', (error) => {
  console.error('Could not start Vite:', error)
  stop(1)
})
api.on('error', (error) => {
  console.error('Could not start the test API:', error)
  stop(1)
})
vite.on('exit', (code) => { if (!stopping && code !== 0) stop(code ?? 1) })
api.on('exit', (code) => { if (!stopping && code !== 0) stop(code ?? 1) })
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
