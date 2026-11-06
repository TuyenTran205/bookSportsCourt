-- Keep existing rejected venues nullable: their historical reason is unknown.
-- New rejection requests must supply a reason at the API boundary.
ALTER TABLE venues ADD COLUMN rejection_reason TEXT;
