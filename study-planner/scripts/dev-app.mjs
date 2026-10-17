import { spawn } from 'node:child_process'

const windows = process.platform === 'win32'
const npmCmd = windows ? (process.env.ComSpec || 'cmd.exe') : 'npm'
const npmPrefix = windows ? ['/d', '/s', '/c', 'npm.cmd'] : []

function run(args, extraEnv = {}) {
  const command = windows ? npmCmd : 'npm'
  const commandArgs = windows ? [...npmPrefix, ...args] : args
  return spawn(command, commandArgs, {
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
    shell: false,
  })
}

const api = run(['run', 'dev', '-w', '@study-planner/api'])
const web = run(['run', 'dev', '-w', '@study-planner/web', '--', '--host', '0.0.0.0'])

let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  api.kill()
  web.kill()
  process.exitCode = code
}

api.on('error', (error) => {
  console.error('Could not start API:', error)
  stop(1)
})
web.on('error', (error) => {
  console.error('Could not start web:', error)
  stop(1)
})
api.on('exit', (code) => { if (!stopping && code !== 0) stop(code ?? 1) })
web.on('exit', (code) => { if (!stopping && code !== 0) stop(code ?? 1) })
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))
