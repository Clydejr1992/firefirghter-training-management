# Fire Department Training Management — GitHub Test v2

### Test accounts
Administrator: `admin@test.com` / `admin123`
Member: `member@test.com` / `member123`

### Included
- Administrator/member login
- Member accounts: active, inactive, reactivate, permanent delete
- Private member folder concept
- Certificate camera capture/upload
- Original certificate scan stored with administrator folder
- Member sees training record, not certificate image
- Training name/date/location/instructor/hours/class number/expiration
- Certification expiration alerts
- Department/member training-hour totals
- Training requirements and missing-training tracking
- Upcoming training calendar
- Required training flag
- Member RSVP / attendance
- Administrator attendance roster
- Training-hour bulletins
- Training offered bulletins
- Individual member messages
- Member dashboard and alerts
- Searchable training records
- CSV report download
- Print report
- Administrator audit log
- Responsive phone/tablet layout

### Important prototype limitation
This GitHub test version stores data in browser localStorage. It is for workflow testing only. Do NOT use it as the production system for real member records/certificates yet.

The production version should use Supabase Auth + Postgres + Storage + Row Level Security so:
- members can only access their own account/data;
- administrators can manage department records;
- certificate files remain private;
- deletion/status controls are enforced server-side;
- records work across phones/computers.
