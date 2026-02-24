Create users in the local SQLite DB from the command line.

Usage:

```
node scripts/create_user.js --name "Full Name" --username alice --password secret123 --role admin
```

- `--role` defaults to `staff` if omitted.
- Make sure the app's DB has been initialized (run `node db/schema.js` or `npm run seed` if you use the seed script).

This script uses `config/database.js` to connect to the same `data/travel.db` used by the app.
