// Postgres vector literal: '[0.1,0.2,...]'
export function toPgVector(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
