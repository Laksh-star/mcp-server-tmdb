import { spawn } from 'child_process';

if (!process.env.TMDB_API_KEY) {
  console.error('TMDB_API_KEY is required. Export it before running this script.');
  process.exit(1);
}

const proc = spawn('/opt/homebrew/opt/node@22/bin/node', ['dist/index.js'], {
  cwd: '/Users/ln/mcp-server-tmdb',
  env: {
    ...process.env
  }
});

proc.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

proc.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

proc.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});
