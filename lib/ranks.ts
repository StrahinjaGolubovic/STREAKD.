/**
 * Trophy ranking system
 * Returns a rank name based on trophy count
 */
export function getTrophyRank(trophies: number): string {
  if (trophies < 250) return 'BRONZE';
  if (trophies < 500) return 'SILVER';
  if (trophies < 1000) return 'GOLD';
  if (trophies < 1500) return 'PLATINUM';
  if (trophies < 2000) return 'DIAMOND';
  if (trophies < 3000) return 'PROFESSIONAL';
  if (trophies < 4000) return 'LOCKED';
  if (trophies < 5000) return 'FURIOUS';
  if (trophies < 6000) return 'GYMRAT';
  if (trophies < 7000) return 'ELITE';
  if (trophies < 8000) return 'DOMINANT';
  if (trophies < 9000) return 'MONSTER';
  if (trophies < 10000) return 'LEGEND';
  return 'BEAST';
}

/**
 * Get rank color style based on trophy count - vibrant and powerful colors
 * Using inline styles to ensure colors always display correctly
 */
export function getRankColorStyle(trophies: number): { color: string } {
  if (trophies < 250) return { color: '#cd7f32' }; // Bronze
  if (trophies < 500) return { color: '#c0c0c0' }; // Silver
  if (trophies < 1000) return { color: '#ffd700' }; // Gold
  if (trophies < 1500) return { color: '#22d3ee' }; // Platinum - cyan
  if (trophies < 2000) return { color: '#60a5fa' }; // Diamond - blue
  if (trophies < 3000) return { color: '#10b981' }; // Professional - green
  if (trophies < 4000) return { color: '#8b5cf6' }; // Locked - purple
  if (trophies < 5000) return { color: '#ef4444' }; // Furious - red
  if (trophies < 6000) return { color: '#f59e0b' }; // Gymrat - amber
  if (trophies < 7000) return { color: '#fbbf24' }; // Elite - yellow
  if (trophies < 8000) return { color: '#ec4899' }; // Dominant - pink
  if (trophies < 9000) return { color: '#dc2626' }; // Monster - dark red
  if (trophies < 10000) return { color: '#818cf8' }; // Legend - indigo
  return { color: '#7c3aed' }; // Beast - violet
}

/**
 * Get rank background gradient and border based on trophy count - vibrant and powerful gradients
 * Border colors match the rank text colors
 */
export function getRankGradient(trophies: number): string {
  if (trophies < 250) return 'bg-gradient-to-br from-orange-900/60 to-orange-800/40 border-2'; // Bronze
  if (trophies < 500) return 'bg-gradient-to-br from-gray-700/60 to-gray-600/40 border-2'; // Silver
  if (trophies < 1000) return 'bg-gradient-to-br from-yellow-900/60 to-yellow-800/40 border-2'; // Gold
  if (trophies < 1500) return 'bg-gradient-to-br from-cyan-900/60 to-cyan-800/40 border-2'; // Platinum
  if (trophies < 2000) return 'bg-gradient-to-br from-blue-900/60 to-blue-800/40 border-2'; // Diamond
  if (trophies < 3000) return 'bg-gradient-to-br from-green-900/60 to-green-800/40 border-2'; // Professional
  if (trophies < 4000) return 'bg-gradient-to-br from-purple-900/60 to-purple-800/40 border-2'; // Locked
  if (trophies < 5000) return 'bg-gradient-to-br from-red-900/60 to-red-800/40 border-2'; // Furious
  if (trophies < 6000) return 'bg-gradient-to-br from-amber-900/60 to-amber-800/40 border-2'; // Gymrat
  if (trophies < 7000) return 'bg-gradient-to-br from-yellow-900/60 to-yellow-800/40 border-2'; // Elite
  if (trophies < 8000) return 'bg-gradient-to-br from-pink-900/60 to-pink-800/40 border-2'; // Dominant
  if (trophies < 9000) return 'bg-gradient-to-br from-red-900/60 to-red-800/40 border-2'; // Monster
  if (trophies < 10000) return 'bg-gradient-to-br from-indigo-900/60 to-indigo-800/40 border-2'; // Legend
  return 'bg-gradient-to-br from-violet-900/60 to-violet-800/40 border-2'; // Beast
}

/**
 * Get rank border color style to match the text color
 */
export function getRankBorderStyle(trophies: number): { borderColor: string } {
  if (trophies < 250) return { borderColor: '#cd7f32' }; // Bronze
  if (trophies < 500) return { borderColor: '#c0c0c0' }; // Silver
  if (trophies < 1000) return { borderColor: '#ffd700' }; // Gold
  if (trophies < 1500) return { borderColor: '#22d3ee' }; // Platinum
  if (trophies < 2000) return { borderColor: '#60a5fa' }; // Diamond
  if (trophies < 3000) return { borderColor: '#10b981' }; // Professional
  if (trophies < 4000) return { borderColor: '#8b5cf6' }; // Locked
  if (trophies < 5000) return { borderColor: '#ef4444' }; // Furious
  if (trophies < 6000) return { borderColor: '#f59e0b' }; // Gymrat
  if (trophies < 7000) return { borderColor: '#fbbf24' }; // Elite
  if (trophies < 8000) return { borderColor: '#ec4899' }; // Dominant
  if (trophies < 9000) return { borderColor: '#dc2626' }; // Monster
  if (trophies < 10000) return { borderColor: '#818cf8' }; // Legend
  return { borderColor: '#7c3aed' }; // Beast
}

