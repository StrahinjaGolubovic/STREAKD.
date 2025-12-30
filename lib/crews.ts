import db from './db';
import { getUserStreak } from './challenges';

export interface Crew {
  id: number;
  name: string;
  leader_id: number;
  tag: string | null;
  tag_color: string;
  created_at: string;
}

export interface CrewMember {
  id: number;
  crew_id: number;
  user_id: number;
  joined_at: string;
}

export interface CrewRequest {
  id: number;
  crew_id: number;
  user_id: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface CrewInfo {
  id: number;
  name: string;
  leader_id: number;
  leader_username: string;
  tag: string | null;
  tag_color: string;
  created_at: string;
  member_count: number;
  average_streak: number;
  average_trophies: number;
  is_member: boolean;
  is_leader: boolean;
  has_pending_request: boolean;
}

export interface CrewMemberInfo {
  id: number;
  user_id: number;
  username: string;
  trophies: number;
  current_streak: number;
  longest_streak: number;
  profile_picture: string | null;
  joined_at: string;
  is_leader: boolean;
}

export interface CrewRequestInfo {
  id: number;
  crew_id: number;
  crew_name: string;
  user_id: number;
  username: string;
  trophies: number;
  current_streak: number;
  created_at: string;
}

const MAX_CREW_MEMBERS = 30;

// Create a new crew
export function createCrew(userId: number, name: string): { success: boolean; crewId?: number; message: string } {
  // Check if user is already in a crew
  const existingMembership = db
    .prepare('SELECT * FROM crew_members WHERE user_id = ?')
    .get(userId) as CrewMember | undefined;

  if (existingMembership) {
    return { success: false, message: 'You are already in a crew' };
  }

  // Check if crew name already exists
  const existingCrew = db
    .prepare('SELECT * FROM crews WHERE name = ?')
    .get(name) as Crew | undefined;

  if (existingCrew) {
    return { success: false, message: 'A crew with this name already exists' };
  }

  // Validate name
  if (name.length < 3 || name.length > 30) {
    return { success: false, message: 'Crew name must be between 3 and 30 characters' };
  }

  if (!/^[a-zA-Z0-9_\s]+$/.test(name)) {
    return { success: false, message: 'Crew name can only contain letters, numbers, underscores, and spaces' };
  }

  try {
    // Create crew
    const { formatDateTimeSerbia } = require('./timezone');
    const createdAt = formatDateTimeSerbia();
    const result = db
      .prepare('INSERT INTO crews (name, leader_id, created_at) VALUES (?, ?, ?)')
      .run(name, userId, createdAt);

    const crewId = result.lastInsertRowid as number;

    // Add creator as member
    db.prepare('INSERT INTO crew_members (crew_id, user_id, joined_at) VALUES (?, ?, ?)').run(crewId, userId, createdAt);

    // Set crew_id on users table for badge display
    db.prepare('UPDATE users SET crew_id = ? WHERE id = ?').run(crewId, userId);

    return { success: true, crewId, message: 'Crew created successfully' };
  } catch (error) {
    return { success: false, message: 'Failed to create crew' };
  }
}

// Search crews by name
export function searchCrews(query: string, userId: number): CrewInfo[] {
  const searchTerm = `%${query}%`;
  const crews = db
    .prepare(`
      SELECT 
        c.id,
        c.name,
        c.leader_id,
        c.tag,
        COALESCE(c.tag_color, '#0ea5e9') as tag_color,
        c.created_at,
        u.username as leader_username,
        COUNT(DISTINCT cm.user_id) as member_count
      FROM crews c
      JOIN users u ON c.leader_id = u.id
      LEFT JOIN crew_members cm ON c.id = cm.crew_id
      WHERE c.name LIKE ?
      GROUP BY c.id
      ORDER BY c.name
      LIMIT 20
    `)
    .all(searchTerm) as Array<{
      id: number;
      name: string;
      leader_id: number;
      tag: string | null;
      tag_color: string;
      created_at: string;
      leader_username: string;
      member_count: number;
    }>;

  return crews.map((crew) => {
    // Check if user is a member
    const membership = db
      .prepare('SELECT * FROM crew_members WHERE crew_id = ? AND user_id = ?')
      .get(crew.id, userId) as CrewMember | undefined;

    // Check if user has pending request
    const request = db
      .prepare('SELECT * FROM crew_requests WHERE crew_id = ? AND user_id = ? AND status = ?')
      .get(crew.id, userId, 'pending') as CrewRequest | undefined;

    // Calculate averages
    const stats = getCrewStats(crew.id);

    return {
      id: crew.id,
      name: crew.name,
      leader_id: crew.leader_id,
      leader_username: crew.leader_username,
      tag: crew.tag,
      tag_color: crew.tag_color || '#0ea5e9',
      created_at: crew.created_at,
      member_count: crew.member_count,
      average_streak: stats.average_streak,
      average_trophies: stats.average_trophies,
      is_member: !!membership,
      is_leader: crew.leader_id === userId,
      has_pending_request: !!request,
    };
  });
}

// Get crew stats (average streak and trophies)
function getCrewStats(crewId: number): { average_streak: number; average_trophies: number } {
  const stats = db
    .prepare(`
      SELECT 
        AVG(COALESCE(s.current_streak, 0)) as avg_streak,
        AVG(COALESCE(u.trophies, 0)) as avg_trophies
      FROM crew_members cm
      JOIN users u ON cm.user_id = u.id
      LEFT JOIN streaks s ON u.id = s.user_id
      WHERE cm.crew_id = ?
    `)
    .get(crewId) as { avg_streak: number; avg_trophies: number } | undefined;

  return {
    average_streak: stats ? Math.round(stats.avg_streak || 0) : 0,
    average_trophies: stats ? Math.round(stats.avg_trophies || 0) : 0,
  };
}

// Get user's current crew
export function getUserCrew(userId: number): CrewInfo | null {
  const membership = db
    .prepare('SELECT * FROM crew_members WHERE user_id = ?')
    .get(userId) as CrewMember | undefined;

  if (!membership) {
    return null;
  }

  const crew = db
    .prepare(`
      SELECT 
        c.id,
        c.name,
        c.leader_id,
        c.tag,
        COALESCE(c.tag_color, '#0ea5e9') as tag_color,
        c.created_at,
        u.username as leader_username,
        COUNT(DISTINCT cm.user_id) as member_count
      FROM crews c
      JOIN users u ON c.leader_id = u.id
      LEFT JOIN crew_members cm ON c.id = cm.crew_id
      WHERE c.id = ?
      GROUP BY c.id
    `)
    .get(membership.crew_id) as {
      id: number;
      name: string;
      leader_id: number;
      tag: string | null;
      tag_color: string;
      created_at: string;
      leader_username: string;
      member_count: number;
    } | undefined;

  if (!crew) {
    return null;
  }

  const stats = getCrewStats(crew.id);

  return {
    id: crew.id,
    name: crew.name,
    leader_id: crew.leader_id,
    leader_username: crew.leader_username,
    tag: crew.tag,
    tag_color: crew.tag_color || '#0ea5e9',
    created_at: crew.created_at,
    member_count: crew.member_count,
    average_streak: stats.average_streak,
    average_trophies: stats.average_trophies,
    is_member: true,
    is_leader: crew.leader_id === userId,
    has_pending_request: false,
  };
}

// Request to join a crew
export function requestToJoinCrew(userId: number, crewId: number): { success: boolean; message: string } {
  // Check if user is already in a crew
  const existingMembership = db
    .prepare('SELECT * FROM crew_members WHERE user_id = ?')
    .get(userId) as CrewMember | undefined;

  if (existingMembership) {
    return { success: false, message: 'You are already in a crew' };
  }

  // Check if crew exists
  const crew = db.prepare('SELECT * FROM crews WHERE id = ?').get(crewId) as Crew | undefined;
  if (!crew) {
    return { success: false, message: 'Crew not found' };
  }

  // Check if crew is full
  const memberCount = db
    .prepare('SELECT COUNT(*) as count FROM crew_members WHERE crew_id = ?')
    .get(crewId) as { count: number } | undefined;

  if (memberCount && memberCount.count >= MAX_CREW_MEMBERS) {
    return { success: false, message: 'This crew is full' };
  }

  // Check if request already exists
  const existingRequest = db
    .prepare('SELECT * FROM crew_requests WHERE crew_id = ? AND user_id = ?')
    .get(crewId, userId) as CrewRequest | undefined;

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      return { success: false, message: 'You already have a pending request for this crew' };
    }
    // If rejected, allow new request
    const { formatDateTimeSerbia } = require('./timezone');
    const createdAt = formatDateTimeSerbia();
    db.prepare('UPDATE crew_requests SET status = ?, created_at = ? WHERE id = ?').run('pending', createdAt, existingRequest.id);
    return { success: true, message: 'Join request sent' };
  }

  // Create new request
  try {
    const { formatDateTimeSerbia } = require('./timezone');
    const createdAt = formatDateTimeSerbia();
    db.prepare('INSERT INTO crew_requests (crew_id, user_id, status, created_at) VALUES (?, ?, ?, ?)').run(crewId, userId, 'pending', createdAt);
    return { success: true, message: 'Join request sent' };
  } catch (error) {
    return { success: false, message: 'Failed to send request' };
  }
}

// Accept a join request (leader only)
export function acceptJoinRequest(leaderId: number, requestId: number): { success: boolean; message: string } {
  // Get request
  const request = db
    .prepare('SELECT * FROM crew_requests WHERE id = ?')
    .get(requestId) as CrewRequest | undefined;

  if (!request) {
    return { success: false, message: 'Request not found' };
  }

  // CRITICAL: Verify leader owns the crew for THIS specific request
  // This prevents leaders from accepting requests for other crews
  const crew = db.prepare('SELECT * FROM crews WHERE id = ? AND leader_id = ?').get(request.crew_id, leaderId) as Crew | undefined;
  if (!crew) {
    return { success: false, message: 'Unauthorized - not your crew' };
  }

  // Check if crew is full
  const memberCount = db
    .prepare('SELECT COUNT(*) as count FROM crew_members WHERE crew_id = ?')
    .get(request.crew_id) as { count: number } | undefined;

  if (memberCount && memberCount.count >= MAX_CREW_MEMBERS) {
    return { success: false, message: 'Crew is full' };
  }

  // Check if user is already in a crew
  const existingMembership = db
    .prepare('SELECT * FROM crew_members WHERE user_id = ?')
    .get(request.user_id) as CrewMember | undefined;

  if (existingMembership) {
    // Remove request
    db.prepare('DELETE FROM crew_requests WHERE id = ?').run(requestId);
    return { success: false, message: 'User is already in a crew' };
  }

  try {
    // Add user to crew
    const { formatDateTimeSerbia } = require('./timezone');
    const joinedAt = formatDateTimeSerbia();
    db.prepare('INSERT INTO crew_members (crew_id, user_id, joined_at) VALUES (?, ?, ?)').run(request.crew_id, request.user_id, joinedAt);

    // Set crew_id on users table for badge display
    db.prepare('UPDATE users SET crew_id = ? WHERE id = ?').run(request.crew_id, request.user_id);

    // Update request status
    db.prepare('UPDATE crew_requests SET status = ? WHERE id = ?').run('approved', requestId);

    return { success: true, message: 'Request accepted' };
  } catch (error) {
    return { success: false, message: 'Failed to accept request' };
  }
}

// Reject a join request (leader only)
export function rejectJoinRequest(leaderId: number, requestId: number): { success: boolean; message: string } {
  const request = db
    .prepare('SELECT * FROM crew_requests WHERE id = ?')
    .get(requestId) as CrewRequest | undefined;

  if (!request) {
    return { success: false, message: 'Request not found' };
  }

  // CRITICAL: Verify leader owns the crew for THIS specific request
  // This prevents leaders from rejecting requests for other crews
  const crew = db.prepare('SELECT * FROM crews WHERE id = ? AND leader_id = ?').get(request.crew_id, leaderId) as Crew | undefined;
  if (!crew) {
    return { success: false, message: 'Unauthorized - not your crew' };
  }

  try {
    db.prepare('UPDATE crew_requests SET status = ? WHERE id = ?').run('rejected', requestId);
    return { success: true, message: 'Request rejected' };
  } catch (error) {
    return { success: false, message: 'Failed to reject request' };
  }
}

// Get pending requests for a crew (leader only)
export function getCrewRequests(crewId: number, leaderId: number): CrewRequestInfo[] {
  // Verify leader
  const crew = db.prepare('SELECT * FROM crews WHERE id = ? AND leader_id = ?').get(crewId, leaderId) as Crew | undefined;
  if (!crew) {
    return [];
  }

  const requests = db
    .prepare(`
      SELECT 
        cr.id,
        cr.crew_id,
        cr.user_id,
        cr.created_at,
        c.name as crew_name,
        u.username,
        COALESCE(u.trophies, 0) as trophies
      FROM crew_requests cr
      JOIN crews c ON cr.crew_id = c.id
      JOIN users u ON cr.user_id = u.id
      WHERE cr.crew_id = ? AND cr.status = ?
      ORDER BY cr.created_at DESC
    `)
    .all(crewId, 'pending') as Array<{
      id: number;
      crew_id: number;
      user_id: number;
      created_at: string;
      crew_name: string;
      username: string;
      trophies: number;
    }>;

  return requests.map((req) => {
    const streak = getUserStreak(req.user_id);
    return {
      id: req.id,
      crew_id: req.crew_id,
      crew_name: req.crew_name,
      user_id: req.user_id,
      username: req.username,
      trophies: req.trophies,
      current_streak: streak.current_streak,
      created_at: req.created_at,
    };
  });
}

// Get crew members
export function getCrewMembers(crewId: number): CrewMemberInfo[] {
  const members = db
    .prepare(`
      SELECT 
        cm.id,
        cm.user_id,
        cm.joined_at,
        u.username,
        COALESCE(u.trophies, 0) as trophies,
        u.profile_picture,
        c.leader_id
      FROM crew_members cm
      JOIN users u ON cm.user_id = u.id
      JOIN crews c ON cm.crew_id = c.id
      WHERE cm.crew_id = ?
      ORDER BY c.leader_id = cm.user_id DESC, cm.joined_at ASC
    `)
    .all(crewId) as Array<{
      id: number;
      user_id: number;
      joined_at: string;
      username: string;
      trophies: number;
      profile_picture: string | null;
      leader_id: number;
    }>;

  return members.map((member) => {
    const streak = getUserStreak(member.user_id);
    return {
      id: member.id,
      user_id: member.user_id,
      username: member.username,
      trophies: member.trophies,
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      profile_picture: member.profile_picture,
      joined_at: member.joined_at,
      is_leader: member.user_id === member.leader_id,
    };
  });
}

// Leave a crew
export function leaveCrew(userId: number): { success: boolean; message: string } {
  const membership = db
    .prepare('SELECT * FROM crew_members WHERE user_id = ?')
    .get(userId) as CrewMember | undefined;

  if (!membership) {
    return { success: false, message: 'You are not in a crew' };
  }

  // Check if user is leader
  const crew = db.prepare('SELECT * FROM crews WHERE id = ?').get(membership.crew_id) as Crew | undefined;
  if (crew && crew.leader_id === userId) {
    return { success: false, message: 'Leaders cannot leave their crew. Transfer leadership or delete the crew first.' };
  }

  try {
    db.prepare('DELETE FROM crew_members WHERE id = ?').run(membership.id);
    
    // Clear crew_id on users table
    db.prepare('UPDATE users SET crew_id = NULL WHERE id = ?').run(userId);
    
    return { success: true, message: 'Left crew successfully' };
  } catch (error) {
    return { success: false, message: 'Failed to leave crew' };
  }
}

// Get crew details with stats
export function getCrewDetails(crewId: number, userId?: number): CrewInfo | null {
  const crew = db
    .prepare(`
      SELECT 
        c.id,
        c.name,
        c.leader_id,
        c.tag,
        COALESCE(c.tag_color, '#0ea5e9') as tag_color,
        c.created_at,
        u.username as leader_username,
        COUNT(DISTINCT cm.user_id) as member_count
      FROM crews c
      JOIN users u ON c.leader_id = u.id
      LEFT JOIN crew_members cm ON c.id = cm.crew_id
      WHERE c.id = ?
      GROUP BY c.id
    `)
    .get(crewId) as {
      id: number;
      name: string;
      leader_id: number;
      tag: string | null;
      tag_color: string;
      created_at: string;
      leader_username: string;
      member_count: number;
    } | undefined;

  if (!crew) {
    return null;
  }

  const stats = getCrewStats(crew.id);

  let is_member = false;
  let has_pending_request = false;

  if (userId) {
    const membership = db
      .prepare('SELECT * FROM crew_members WHERE crew_id = ? AND user_id = ?')
      .get(crewId, userId) as CrewMember | undefined;
    is_member = !!membership;

    const request = db
      .prepare('SELECT * FROM crew_requests WHERE crew_id = ? AND user_id = ? AND status = ?')
      .get(crewId, userId, 'pending') as CrewRequest | undefined;
    has_pending_request = !!request;
  }

  return {
    id: crew.id,
    name: crew.name,
    leader_id: crew.leader_id,
    leader_username: crew.leader_username,
    tag: crew.tag,
    tag_color: crew.tag_color || '#0ea5e9',
    created_at: crew.created_at,
    member_count: crew.member_count,
    average_streak: stats.average_streak,
    average_trophies: stats.average_trophies,
    is_member,
    is_leader: userId ? crew.leader_id === userId : false,
    has_pending_request,
  };
}

// Update crew tag (leader only)
export function updateCrewTag(leaderId: number, crewId: number, tag: string | null, tagColor: string): { success: boolean; message: string } {
  // Verify leader
  const crew = db.prepare('SELECT * FROM crews WHERE id = ? AND leader_id = ?').get(crewId, leaderId) as Crew | undefined;
  if (!crew) {
    return { success: false, message: 'Unauthorized or crew not found' };
  }

  // Validate tag if provided
  if (tag !== null) {
    const trimmedTag = tag.trim().toUpperCase();
    if (trimmedTag.length < 3 || trimmedTag.length > 4) {
      return { success: false, message: 'Tag must be between 3 and 4 characters' };
    }
    if (!/^[A-Z0-9]+$/.test(trimmedTag)) {
      return { success: false, message: 'Tag can only contain uppercase letters and numbers' };
    }

    // Check if tag is already taken by another crew
    const existingCrew = db.prepare('SELECT id FROM crews WHERE tag = ? AND id != ?').get(trimmedTag, crewId) as { id: number } | undefined;
    if (existingCrew) {
      return { success: false, message: 'This tag is already taken by another crew' };
    }

    // Validate color (hex color)
    if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(tagColor)) {
      return { success: false, message: 'Invalid color format' };
    }

    try {
      db.prepare('UPDATE crews SET tag = ?, tag_color = ? WHERE id = ?').run(trimmedTag, tagColor, crewId);
      return { success: true, message: 'Crew tag updated successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to update crew tag' };
    }
  } else {
    // Remove tag
    try {
      db.prepare('UPDATE crews SET tag = NULL, tag_color = ? WHERE id = ?').run(tagColor, crewId);
      return { success: true, message: 'Crew tag removed successfully' };
    } catch (error) {
      return { success: false, message: 'Failed to remove crew tag' };
    }
  }
}

