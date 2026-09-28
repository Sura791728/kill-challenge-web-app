import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const streams = sqliteTable('streams', {
  userId: text('user_id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  payload: text('payload').notNull(),
});

export const overlayLinks = sqliteTable('overlay_links', {
  streamKey: text('stream_key').primaryKey(),
  token: text('token').notNull(),
}, table => [uniqueIndex('overlay_links_token_unique').on(table.token)]);

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  passwordSalt: text('password_salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  recoveryHash: text('recovery_hash').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('accounts_username_unique').on(table.username)]);

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('sessions_account_idx').on(table.accountId)]);

export const authLimits = sqliteTable('auth_limits', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  windowStart: integer('window_start').notNull(),
});
