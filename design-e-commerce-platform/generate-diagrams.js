import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir } from 'fs/promises';
import path from 'path';

const execPromise = promisify(exec);

const diagramFiles = [
  '01-architecture.mmd',
  '02-write-flow.mmd',
  '03-read-flow.mmd',
  '04-replication-lag.mmd',
  '05-api-routing.mmd'
];

async function generateDiagrams() {
  console.log('🎨 Generating PNG diagrams from Mermaid files...\n');

  for (const file of diagramFiles) {
    const inputPath = `diagrams/${file}`;
    const outputPath = `diagrams/${file.replace('.mmd', '.png')}`;
    const name = file.replace('.mmd', '').replace(/-/g, ' ').toUpperCase();

    try {
      console.log(`  📊 Generating ${name}...`);
      await execPromise(
        `npx mmdc -i ${inputPath} -o ${outputPath} -t dark -b transparent`
      );
      console.log(`     ✅ Created ${outputPath}`);
    } catch (error) {
      console.error(`     ❌ Failed to generate ${file}:`, error.message);
    }
  }

  console.log('\n✨ Diagram generation complete!\n');
  console.log('📁 PNG files saved in: diagrams/');
  console.log('   - 01-architecture.png');
  console.log('   - 02-write-flow.png');
  console.log('   - 03-read-flow.png');
  console.log('   - 04-replication-lag.png');
  console.log('   - 05-api-routing.png\n');
}

generateDiagrams().catch(console.error);
