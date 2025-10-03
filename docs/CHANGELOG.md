# Changelog

## [2.0.0] - 2025-01-20

### 🎉 Major Release: Multi-Key Rotation & Advanced Features

This release introduces comprehensive enhancements to the Claude Code Nexus platform, transforming it into an enterprise-ready AI gateway with advanced load balancing, monitoring, and management capabilities.

### ✨ New Features

#### Multi-Key Rotation System
- **Weighted Round-Robin Algorithm**: Intelligent key selection based on priority and weight
- **Automatic Failover**: Seamless switching to backup keys on errors
- **Health Monitoring**: Track success rates, failure counts, and usage patterns
- **Statistics Dashboard**: Real-time metrics for each configured key
- **Flexible Configuration**: Priority-based and weight-based traffic control

#### Gateway Logging & Analytics
- **Request/Response Tracking**: Complete audit trail of all API calls
- **Token Usage Statistics**: Monitor input/output/total tokens per request
- **Latency Analysis**: Track response times and identify bottlenecks
- **Success Rate Monitoring**: Real-time visibility into service health
- **30-Day Retention**: Automatic cleanup of old logs
- **Statistics Dashboard**: Aggregated metrics and insights

#### Proxy Support
- **Cloudflare Workers Proxy**: Built-in proxy for Google Gemini to bypass regional restrictions
- **GitHub Pages Proxy**: Alternative proxy solution for redundancy
- **Automatic Detection**: System automatically applies proxies when needed
- **Custom Proxy Support**: Configure your own proxy endpoints

#### User API Key Management
- **Key Regeneration**: One-click regeneration with confirmation
- **Security Features**: Encrypted storage and masked display
- **Audit Trail**: All key changes logged to gateway logs
- **Instant Revocation**: Old keys invalidated immediately

#### Flexible Model Configuration
- **Latest Claude Models**: Support for Sonnet 3.5 v2, Sonnet 4, and future models
- **Dynamic Configuration**: No hardcoded model names
- **Updated Default Mappings**: Optimized for latest Gemini models
- **Custom Mappings**: Map any Claude model to any target model

### 🔧 Technical Improvements

#### Database Schema
- Added `provider_keys` table for multi-key storage
- Added `gateway_logs` table for comprehensive logging
- Added `proxy_configs` table for proxy management
- Proper indexing for performance optimization
- Foreign key constraints for data integrity

#### API Enhancements
- New `/api/keys` endpoint for key management (GET, POST, PUT, DELETE)
- New `/api/logs` endpoint for log viewing and statistics
- New `/api/user/regenerate-key` endpoint for key regeneration
- Enhanced error handling and validation
- OpenAPI documentation via Hono

#### Frontend UI Updates
- **Keys Management Page**: Full CRUD interface for provider keys
- **Logs Viewer Page**: Interactive log browser with statistics
- **Enhanced Dashboard**: API key regeneration feature
- **Updated Navigation**: New menu items for keys and logs
- **Improved UX**: Real-time updates and better error messaging

#### Services Layer
- `KeyRotationService`: Intelligent key selection and health management
- `ProxyService`: Proxy detection and application logic
- `GatewayLogService`: Logging and statistics collection
- Clean separation of concerns and testable architecture

### 📚 Documentation

#### New Guides
- **USER_GUIDE.md**: Comprehensive user documentation with examples
- **MULTI_KEY_GUIDE.md**: Deep dive into multi-key system architecture
- **Updated README.md**: New features overview and quick start

#### Enhanced Guides
- API reference documentation
- Deployment instructions
- Troubleshooting guides
- Security best practices

### 🔒 Security Enhancements

- All API keys encrypted with AES-GCM
- User data isolation enforced at database level
- Authentication middleware on all protected routes
- Input validation using Zod schemas
- Audit logging for sensitive operations
- No secrets in code or logs

### ⚡ Performance Optimizations

- Database indexes on frequently queried fields
- Efficient query patterns to minimize roundtrips
- Async logging to avoid request blocking
- Proper use of foreign keys for data integrity
- Minimal overhead per request (~5-10ms)

### 🔄 Migration Guide

#### For Existing Users

1. **Backward Compatibility**: All existing configurations continue to work
2. **Optional Upgrade**: Multi-key is optional; single-key mode still supported
3. **Database Migration**: Run `pnpm db:migrate:prod` to apply schema changes
4. **No Breaking Changes**: Existing API Keys remain valid

#### For New Users

1. Follow the updated [Deployment Guide](./DEPLOYMENT.md)
2. Configure at least one provider key in the Keys Management page
3. Optionally configure multiple keys for high availability

### 📊 Statistics

- **15 Files Modified**: Backend services, routes, and utilities
- **5 Files Created**: New pages and documentation
- **3 New Database Tables**: provider_keys, proxy_configs, gateway_logs
- **8 API Endpoints Added**: Complete CRUD operations
- **2 Frontend Pages Added**: Keys and Logs viewers
- **3 Documentation Guides**: Comprehensive coverage

### 🐛 Bug Fixes

- Fixed TypeScript type errors in frontend
- Improved error handling in Claude route
- Better validation for API requests
- Enhanced CORS handling

### 🚀 What's Next

Potential future enhancements:

- Rate limiting per provider key
- Advanced alerting and notifications
- A/B testing capabilities
- Geographic load balancing
- Webhook support for events
- GraphQL API option

### 🙏 Acknowledgments

Thanks to all contributors and users who provided feedback and suggestions.

Special thanks to:
- The Claude Code community
- Cloudflare team for the amazing platform
- All early adopters and testers

---

## [1.0.0] - 2025-01-15

### Initial Release

- Basic Claude API proxy functionality
- GitHub OAuth authentication
- Simple model mapping
- User configuration interface
- Cloudflare deployment support

---

**For detailed upgrade instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)**

**For feature documentation, see [USER_GUIDE.md](./USER_GUIDE.md)**
