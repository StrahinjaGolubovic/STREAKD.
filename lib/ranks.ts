/**
 * Trophy ranking system
 * Returns a rank name based on trophy count (one rank per 100 trophies)
 */
export function getTrophyRank(trophies: number): string {
  if (trophies < 100) return 'BRONZE';
  if (trophies < 200) return 'SILVER';
  if (trophies < 300) return 'GOLD';
  if (trophies < 400) return 'PLATINUM';
  if (trophies < 500) return 'DIAMOND';
  if (trophies < 600) return 'MASTER';
  if (trophies < 700) return 'GRANDMASTER';
  if (trophies < 800) return 'CHAMPION';
  if (trophies < 900) return 'LEGEND';
  if (trophies < 1000) return 'ELITE';
  return 'SUPREME';
}

/**
 * Get rank color style based on trophy count - vibrant and powerful colors
 * Using inline styles to ensure colors always display correctly
 */
export function getRankColorStyle(trophies: number): { color: string } {
  if (trophies < 100) return { color: '#fb923c' }; // orange-400 - Bronze
  if (trophies < 200) return { color: '#e5e7eb' }; // gray-200 - Silver
  if (trophies < 300) return { color: '#facc15' }; // yellow-400 - Gold
  if (trophies < 400) return { color: '#22d3ee' }; // cyan-400 - Platinum
  if (trophies < 500) return { color: '#60a5fa' }; // blue-400 - Diamond
  if (trophies < 600) return { color: '#a78bfa' }; // purple-400 - Master
  if (trophies < 700) return { color: '#f472b6' }; // pink-400 - Grandmaster
  if (trophies < 800) return { color: '#f87171' }; // red-400 - Champion
  if (trophies < 900) return { color: '#818cf8' }; // indigo-400 - Legend
  if (trophies < 1000) return { color: '#fbbf24' }; // amber-400 - Elite
  return { color: '#fde047' }; // yellow-300 - Supreme
}

/**
 * Get rank background gradient and border based on trophy count - vibrant and powerful gradients
 * Border colors match the rank text colors
 */
export function getRankGradient(trophies: number): string {
  if (trophies < 100) return 'bg-gradient-to-br from-orange-900/60 to-orange-800/40 border-2'; // Bronze - vibrant orange
  if (trophies < 200) return 'bg-gradient-to-br from-gray-700/60 to-gray-600/40 border-2'; // Silver - bright silver
  if (trophies < 300) return 'bg-gradient-to-br from-yellow-900/60 to-yellow-800/40 border-2'; // Gold - bright gold
  if (trophies < 400) return 'bg-gradient-to-br from-cyan-900/60 to-cyan-800/40 border-2'; // Platinum - bright cyan
  if (trophies < 500) return 'bg-gradient-to-br from-blue-900/60 to-blue-800/40 border-2'; // Diamond - vibrant blue
  if (trophies < 600) return 'bg-gradient-to-br from-purple-900/60 to-purple-800/40 border-2'; // Master - vibrant purple
  if (trophies < 700) return 'bg-gradient-to-br from-pink-900/60 to-pink-800/40 border-2'; // Grandmaster - vibrant pink
  if (trophies < 800) return 'bg-gradient-to-br from-red-900/60 to-red-800/40 border-2'; // Champion - powerful red
  if (trophies < 900) return 'bg-gradient-to-br from-indigo-900/60 to-indigo-800/40 border-2'; // Legend - vibrant indigo
  if (trophies < 1000) return 'bg-gradient-to-br from-amber-900/60 to-amber-800/40 border-2'; // Elite - bright amber
  return 'bg-gradient-to-br from-yellow-800/70 to-yellow-700/50 border-2'; // Supreme - glowing yellow
}

/**
 * Get rank border color style to match the text color
 */
export function getRankBorderStyle(trophies: number): { borderColor: string } {
  if (trophies < 100) return { borderColor: '#fb923c' }; // orange-400 - Bronze
  if (trophies < 200) return { borderColor: '#e5e7eb' }; // gray-200 - Silver
  if (trophies < 300) return { borderColor: '#facc15' }; // yellow-400 - Gold
  if (trophies < 400) return { borderColor: '#22d3ee' }; // cyan-400 - Platinum
  if (trophies < 500) return { borderColor: '#60a5fa' }; // blue-400 - Diamond
  if (trophies < 600) return { borderColor: '#a78bfa' }; // purple-400 - Master
  if (trophies < 700) return { borderColor: '#f472b6' }; // pink-400 - Grandmaster
  if (trophies < 800) return { borderColor: '#f87171' }; // red-400 - Champion
  if (trophies < 900) return { borderColor: '#818cf8' }; // indigo-400 - Legend
  if (trophies < 1000) return { borderColor: '#fbbf24' }; // amber-400 - Elite
  return { borderColor: '#fde047' }; // yellow-300 - Supreme
}

