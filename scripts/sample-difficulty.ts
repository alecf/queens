/**
 * Sample board generation metrics to understand difficulty distribution per board size.
 * Run with: npx tsx scripts/sample-difficulty.ts
 */
import { generateBoard } from '../src/lib/generator';
import type { BoardSize } from '../src/lib/types';

const SIZES: BoardSize[] = [5, 6, 7, 8, 9];
const SAMPLES_PER_SIZE = 300;

interface SampleResult {
  size: BoardSize;
  totalSolverNodes: number;
  swapCount: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.max(0, Math.floor(sorted.length * p / 100) - 1);
  return sorted[idx];
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  return Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length);
}

async function main() {
  const allResults: SampleResult[] = [];

  for (const size of SIZES) {
    process.stdout.write(`Sampling size ${size} (${SAMPLES_PER_SIZE} boards)...`);
    const start = Date.now();

    for (let i = 0; i < SAMPLES_PER_SIZE; i++) {
      const { metrics } = generateBoard(size);
      allResults.push({ size, totalSolverNodes: metrics.totalSolverNodes, swapCount: metrics.swapCount });
      if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}`);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(` done (${elapsed}s)`);
  }

  console.log('\n=== RESULTS BY SIZE ===\n');

  for (const size of SIZES) {
    const results = allResults.filter(r => r.size === size);
    const nodes = results.map(r => r.totalSolverNodes).sort((a, b) => a - b);
    const swaps = results.map(r => r.swapCount).sort((a, b) => a - b);
    const nodesMean = mean(nodes);
    const nodesStd = stddev(nodes, nodesMean);
    const swapsMean = mean(swaps);

    console.log(`--- Size ${size} (n=${results.length}) ---`);
    console.log(`  totalSolverNodes:`);
    console.log(`    min=${nodes[0].toLocaleString()}  max=${nodes[nodes.length-1].toLocaleString()}  mean=${Math.round(nodesMean).toLocaleString()}  stddev=${Math.round(nodesStd).toLocaleString()}`);
    console.log(`    p10=${percentile(nodes, 10).toLocaleString()}  p25=${percentile(nodes, 25).toLocaleString()}  p50=${percentile(nodes, 50).toLocaleString()}  p75=${percentile(nodes, 75).toLocaleString()}  p90=${percentile(nodes, 90).toLocaleString()}  p95=${percentile(nodes, 95).toLocaleString()}  p99=${percentile(nodes, 99).toLocaleString()}`);
    console.log(`  swapCount:`);
    console.log(`    min=${swaps[0]}  max=${swaps[swaps.length-1]}  mean=${swapsMean.toFixed(1)}  p50=${percentile(swaps, 50)}  p90=${percentile(swaps, 90)}  p99=${percentile(swaps, 99)}`);
    console.log();
  }

  // Cross-size summary
  console.log('=== CROSS-SIZE SUMMARY (totalSolverNodes) ===\n');
  console.log('size | p10       | p25       | p50       | p75       | p90       | p99       | max');
  console.log('-----|-----------|-----------|-----------|-----------|-----------|-----------|----------');
  for (const size of SIZES) {
    const nodes = allResults.filter(r => r.size === size).map(r => r.totalSolverNodes).sort((a, b) => a - b);
    const p = (v: number) => v.toLocaleString().padStart(9);
    console.log(`  ${size}  |${p(percentile(nodes, 10))} |${p(percentile(nodes, 25))} |${p(percentile(nodes, 50))} |${p(percentile(nodes, 75))} |${p(percentile(nodes, 90))} |${p(percentile(nodes, 99))} |${p(nodes[nodes.length-1])}`);
  }

  // Correlation check: nodes vs swaps
  console.log('\n=== NODE/SWAP CORRELATION (size 7, first 20 samples) ===\n');
  const size7 = allResults.filter(r => r.size === 7).slice(0, 20);
  for (const r of size7) {
    const bar = '#'.repeat(Math.min(50, Math.round(r.totalSolverNodes / 5000)));
    console.log(`  nodes=${r.totalSolverNodes.toString().padStart(8)}  swaps=${r.swapCount.toString().padStart(4)}  ${bar}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
