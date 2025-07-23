// utils/roomSessionsDb.ts
import { Pool } from 'pg'; 


import db from '@/db.js';


const pool = db.pool as Pool;

/**
 * Represents a record in the room_sessions table.
 */
export interface RoomSessionRow {
  room_id: string;
  stage: number;
  header?: string | null;
  text?: string | null;
  images?: any; // JSONB
  updated_at?: string | null; // timestamptz
}

/**
 * Get a room session from the DB by roomId.
 */
export async function getRoomSession(roomId: string): Promise<RoomSessionRow | null> {
  const query = `
    SELECT *
    FROM room_sessions
    WHERE room_id = $1
    LIMIT 1;
  `;
  const values = [roomId];

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

/**
 * Create a new room session in the DB.
 */
export async function createRoomSession(
  roomId: string, 
  stage: number, 
  header: string | null, 
  text: string | null, 
  images: any // JSON structure
): Promise<RoomSessionRow> {
  const query = `
    INSERT INTO room_sessions (room_id, stage, header, text, images, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *;
  `;
  const values = [roomId, stage, header, text, JSON.stringify(images)];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Update an existing room session.
 */
export async function updateRoomSession(
  roomId: string,
  stage: number,
  header?: string,
  text?: string,
  images?: any
): Promise<RoomSessionRow> {
  const query = `
    UPDATE room_sessions
    SET 
      stage = $2,
      header = COALESCE($3, header),
      text = COALESCE($4, text),
      images = COALESCE($5, images),
      updated_at = NOW()
    WHERE room_id = $1
    RETURNING *;
  `;
  const values = [
    roomId,
    stage,
    header !== undefined ? header : null,
    text !== undefined ? text : null,
    images !== undefined ? JSON.stringify(images) : null
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Delete a room session row from DB.
 */
export async function deleteRoomSession(roomId: string): Promise<void> {
  const query = `
    DELETE FROM room_sessions
    WHERE room_id = $1
  `;
  await pool.query(query, [roomId]);
}
