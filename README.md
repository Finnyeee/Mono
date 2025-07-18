# Team Session Manager

A basic web application that allows multiple players to create and join sessions for managing teams. Built with Node.js, Express, and Socket.io for real-time collaboration.

## Features

- **Create Sessions**: One player can create a session and get a unique session ID
- **Join Sessions**: Other players can join using the session ID
- **Detailed Team System**: Each player inputs detailed descriptions for 3 teams (up to 500 characters each)
- **Automatic Team Labeling**: Teams are automatically labeled based on content rules
- **Ban Phase**: Players simultaneously ban one of their opponent's teams
- **Real-time Updates**: All changes are synchronized across all connected users
- **Multiple Sessions**: Support for multiple concurrent sessions
- **Phase Management**: Automatic progression through waiting → team input → banning → completed
- **User Roles**: Automatic role assignment (Creator, Joiner, Observer)
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Open Your Browser**
   Navigate to `http://localhost:3000`

## Development

For development with auto-restart:
```bash
npm run dev
```

## How to Use

### Creating a Session
1. Go to the homepage
2. Click "Create New Session"
3. Click "Create Session" to generate a unique session ID
4. Share the session ID with other players
5. Click "Enter Session" to start managing teams

### Joining a Session
1. Go to the homepage
2. Click "Join Existing Session"
3. Enter the session ID provided by the session creator
4. Click "Join Session"

### Draft Process
1. **Waiting Phase**: Both players must join the session
2. **Team Input Phase**: Each player enters detailed descriptions for 3 teams (min 10, max 500 characters)
3. **Labeling**: Teams are automatically labeled based on content rules
4. **Ban Phase**: Players simultaneously ban one opponent team based on labels only (opponent content hidden, bans hidden until both choose)
5. **Completed Phase**: View final teams with labels after bans (own content expandable, opponent content remains hidden)
- All changes are automatically synchronized with other users

## Technical Details

### Backend
- **Node.js** with Express for the web server
- **Socket.io** for real-time WebSocket communication
- **UUID** for generating unique session IDs
- In-memory session storage (resets on server restart)

### Frontend
- Vanilla HTML, CSS, and JavaScript
- Socket.io client for real-time updates
- Responsive design with modern UI
- Client-side form validation

### Session Management
- Sessions are stored in memory (Map data structure)
- Each session supports one creator and one joiner (plus observers)
- Session IDs are 8-character uppercase strings
- Four phases: waiting, team_input, banning, completed
- Real-time synchronization of team submissions and bans

## File Structure

```
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── public/            # Static files
│   ├── index.html     # Homepage
│   ├── create.html    # Session creation page
│   ├── join.html      # Session joining page
│   ├── session.html   # Main session interface
│   └── style.css      # Stylesheet
└── README.md          # This file
```

## API Endpoints

- `GET /` - Homepage
- `GET /create` - Session creation page
- `GET /join` - Session joining page
- `GET /session/:id` - Session interface
- `POST /api/create-session` - Create a new session
- `POST /api/join-session` - Join an existing session
- `GET /api/session/:id` - Get session data

## Socket Events

### Client to Server
- `join-session` - Join a session room
- `submit-teams` - Submit 3 teams for draft
- `ban-team` - Ban an opponent's team

### Server to Client
- `role-assigned` - Notify user of their role
- `session-update` - Send updated session data
- `user-joined` - Notify when a user joins
- `user-left` - Notify when a user leaves

## Future Enhancements

This basic structure can be extended with:
- Database persistence
- User authentication
- Team editing capabilities
- Session expiration
- More advanced team features
- Chat functionality
- File uploads
- Admin controls

## License

ISC 