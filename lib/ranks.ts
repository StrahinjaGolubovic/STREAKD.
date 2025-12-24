/**
 * Trophy ranking system
 * Returns a rank name based on trophy count (one rank per 100 trophies)
 */
export function getTrophyRank(trophies: number): string {
  if (trophies < 100) return 'Bronze';
  if (trophies < 200) return 'Silver';
  if (trophies < 300) return 'Gold';
  if (trophies < 400) return 'Platinum';
  if (trophies < 500) return 'Diamond';
  if (trophies < 600) return 'Master';
  if (trophies < 700) return 'Grandmaster';
  if (trophies < 800) return 'Champion';
  if (trophies < 900) return 'Legend';
  if (trophies < 1000) return 'Elite';
  return 'Supreme';
}

/**
 * Get rank color based on trophy count - vibrant and powerful colors
 */
export function getRankColor(trophies: number): string {
  if (trophies < 100) return 'text-orange-600'; // Bronze - vibrant orange
  if (trophies < 200) return 'text-gray-200'; // Silver - bright silver
  if (trophies < 300) return 'text-yellow-500'; // Gold - bright gold
  if (trophies < 400) return 'text-cyan-500'; // Platinum - bright cyan
  if (trophies < 500) return 'text-blue-500'; // Diamond - vibrant blue
  if (trophies < 600) return 'text-purple-500'; // Master - vibrant purple
  if (trophies < 700) return 'text-pink-500'; // Grandmaster - vibrant pink
  if (trophies < 800) return 'text-red-500'; // Champion - powerful red
  if (trophies < 900) return 'text-indigo-500'; // Legend - vibrant indigo
  if (trophies < 1000) return 'text-amber-500'; // Elite - bright amber
  return 'text-yellow-400'; // Supreme - glowing yellow
}

/**
 * Get rank background gradient based on trophy count - vibrant and powerful gradients
 */
export function getRankGradient(trophies: number): string {
  if (trophies < 100) return 'bg-gradient-to-br from-orange-800/50 to-orange-700/30 border-2 border-orange-500/60'; // Bronze - vibrant orange
  if (trophies < 200) return 'bg-gradient-to-br from-gray-600/50 to-gray-500/30 border-2 border-gray-300/60'; // Silver - bright silver
  if (trophies < 300) return 'bg-gradient-to-br from-yellow-700/50 to-yellow-600/30 border-2 border-yellow-400/60'; // Gold - bright gold
  if (trophies < 400) return 'bg-gradient-to-br from-cyan-700/50 to-cyan-600/30 border-2 border-cyan-300/60'; // Platinum - bright cyan
  if (trophies < 500) return 'bg-gradient-to-br from-blue-700/50 to-blue-600/30 border-2 border-blue-400/60'; // Diamond - vibrant blue
  if (trophies < 600) return 'bg-gradient-to-br from-purple-700/50 to-purple-600/30 border-2 border-purple-400/60'; // Master - vibrant purple
  if (trophies < 700) return 'bg-gradient-to-br from-pink-700/50 to-pink-600/30 border-2 border-pink-400/60'; // Grandmaster - vibrant pink
  if (trophies < 800) return 'bg-gradient-to-br from-red-700/50 to-red-600/30 border-2 border-red-500/60'; // Champion - powerful red
  if (trophies < 900) return 'bg-gradient-to-br from-indigo-700/50 to-indigo-600/30 border-2 border-indigo-400/60'; // Legend - vibrant indigo
  if (trophies < 1000) return 'bg-gradient-to-br from-yellow-600/60 to-yellow-500/40 border-2 border-yellow-300/70'; // Elite - bright yellow
  return 'bg-gradient-to-br from-yellow-500/70 to-yellow-400/50 border-2 border-yellow-200/80'; // Supreme - glowing yellow
}

