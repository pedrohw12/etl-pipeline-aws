import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildSync } from 'esbuild';
import * as pulumi from '@pulumi/pulumi';

export function bundleLambda(entry: string): pulumi.asset.AssetArchive {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lambda-'));
  const outFile = path.join(tempDir, 'index.js');

  buildSync({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    minify: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    external: ['aws-sdk'],
    sourcemap: false,
  });

  return new pulumi.asset.AssetArchive({
    'index.js': new pulumi.asset.FileAsset(outFile),
  });
}
