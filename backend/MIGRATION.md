# Identity Cloud — Migration to MongoDB Atlas + Cloudinary

This release migrates the IdentityCloud backend from **LokiJS** (file-based,
ephemeral on serverless hosts) to **MongoDB Atlas** for persistent structured
data, and from **GitHub / local disk** photo storage to **Cloudinary**.

The public API contract is **unchanged** — CardStudio does not need any update.

## What changed

| Concern             | Before                          | After                                     |
| ------------------- | ------------------------------- | ----------------------------------------- |
| Structured data     | LokiJS (`data/identity-cloud.db`) | MongoDB Atlas (Mongoose models)           |
| Image storage       | GitHub repo + local disk        | Cloudinary (`secure_url` stored in Mongo) |
| API routes          | Same                            | **Same**                                  |
| `db.*` adapter      | Loki wrapper                    | Mongo wrapper exposing the same methods   |

## New environment variables

```
MONGO_URI=mongodb+srv://...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=identity-cloud/students   # optional
CLOUDINARY_MAX_BYTES=10485760               # optional, 10 MB default
DUAL_WRITE_LOKI=0                           # set to 1 during cut-over window
```

## Roll-out (zero data loss)

1. **Deploy** the new backend with `MONGO_URI`, Cloudinary keys, and
   `DUAL_WRITE_LOKI=1`. Existing LokiJS DB files are preserved on disk.
2. **Run the migration script** once — it imports schools, students, logs and
   admins, and uploads any local / remote photos to Cloudinary:

   ```bash
   npm run migrate:loki-to-mongo
   ```

   The script is idempotent (uses upserts) — safe to re-run.

3. **Verify** in Atlas (`schools`, `students`, `logs`, `admins` collections)
   and in the Cloudinary media library (`identity-cloud/students/<schoolSlug>/...`).
4. **Switch off dual-write** by setting `DUAL_WRITE_LOKI=0` (default).
5. **Cleanup** (final phase): once you're confident, you may remove `lokijs` and
   `db/lokijs.js`, and delete `uploads/photos/` and the `githubStorage.js` file.
   They are kept now to guarantee a safe rollback path.

## API surface (unchanged)

- `POST /api/publish` — receives student cards from CardStudio (same JSON shape,
  including `photoData` as a base64 data-URL).
- `GET  /api/verify/:schoolSlug/:studentId`
- `GET  /api/school/:slug`
- `GET  /api/school/:slug/students`
- `GET  /api/stats`
- `GET  /api/health`
- All `/api/admin/*` routes (login, overview, schools CRUD, students CRUD, logs)

## Notes

- New photos are **never** written to disk or to GitHub.
- If Cloudinary is mis-configured at publish time, the upload is logged and
  skipped — the rest of the publish still succeeds (no crash, no data loss).
- `db.save()` is now a no-op; Mongo writes are immediate.
