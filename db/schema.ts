import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const streams = sqliteTable('streams', {
  userId: text('user_id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: text('payload').notNull(),
});

export const overlayLinks = sqliteTable('overlay_links', {
  streamKey: text('stream_key').primaryKey(),
  token: text('token').notNull(),
}, table => [uniqueIndex('overlay_links_token_unique').on(table.token)]);
