-- Raise single-object upload limit for library zips (was 50 MiB).
-- Tier quotas (Basic 2 GiB / Pro 20 GiB) are enforced in the client; this is the Storage hard ceiling.

UPDATE storage.buckets
SET file_size_limit = 26843545600 -- 25 GiB (binary), headroom above Pro tier
WHERE id = 'libraries';
