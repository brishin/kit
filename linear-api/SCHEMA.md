# Linear GraphQL API Schema

This document provides a comprehensive overview of the Linear GraphQL API schema discovered through introspection at `https://api.linear.app/graphql`.

## Overview

The Linear GraphQL API is a comprehensive interface for project management, team collaboration, and integration management. It supports:

- **Query Operations**: 136+ queries for reading data
- **Mutation Operations**: 400+ mutations for creating and updating data
- **Authentication**: Requires API token in Authorization header for actual data access (introspection is publicly available)

## Query Operations

### Issues & Search
- `issues` - All issues
- `issue` - One specific issue
- `issueSearch` - [DEPRECATED] Search issues (use `searchIssues` instead)
- `searchIssues` - Search issues with advanced filtering
- `issueVcsBranchSearch` - Find issue based on VCS branch name
- `issueFigmaFileKeySearch` - Find issues related to a Figma file key
- `issueFilterSuggestion` - Suggests filters for an issue view based on text prompt
- `issuePriorityValues` - Issue priority values and corresponding labels
- `issueRepositorySuggestions` - Returns repositories most relevant for implementing an issue

### Issues - Relationships & Metadata
- `issueRelations` - All issue relationships
- `issueRelation` - One specific issue relation
- `issueLabels` - All issue labels
- `issueLabel` - One specific label

### Issues - Import & Sync
- `issueImportCheckCSV` - Checks CSV file validity for import
- `issueImportCheckSync` - Checks if sync setup is possible for a project/repository
- `issueImportJqlCheck` - Validates custom JQL query for Jira import

### Users
- `users` - All users for the organization
- `user` - One specific user
- `viewer` - The currently authenticated user
- `availableUsers` - Fetch users belonging to this user account
- `externalUsers` - All external users for the organization
- `externalUser` - One specific external user

### Teams
- `teams` - All teams whose issues can be accessed by the user
- `administrableTeams` - All teams the user can administrate (settings accessible)
- `team` - One specific team
- `teamMemberships` - All team memberships
- `teamMembership` - One specific team membership
- `archivedTeams` - [Internal] All archived teams of the organization

### Projects
- `projects` - All projects
- `project` - One specific project
- `projectFilterSuggestion` - Suggests filters for a project view based on text prompt
- `projectUpdates` - All project updates
- `projectUpdate` - A specific project update
- `projectStatuses` - All project statuses
- `projectStatus` - One specific project status
- `projectStatusProjectCount` - [INTERNAL] Count of projects using a project status
- `projectRelations` - All project relationships
- `projectRelation` - One specific project relation
- `projectMilestones` - All milestones for a project
- `projectMilestone` - One specific project milestone
- `projectLabels` - All project labels
- `projectLabel` - One specific label

### Cycles
- `cycles` - All cycles
- `cycle` - One specific cycle

### Comments
- `comments` - All comments
- `comment` - A specific comment

### Organization
- `organization` - The user's organization
- `organizationExists` - Does the organization exist
- `organizationMeta` - [INTERNAL] Get organization metadata by urlKey or organization ID
- `organizationInvites` - All invites for the organization
- `organizationInvite` - One specific organization invite
- `organizationInviteDetails` - One specific organization invite with details
- `organizationDomainClaimRequest` - [INTERNAL] Checks whether a domain can be claimed

### Notifications
- `notifications` - All notifications
- `notificationsUnreadCount` - [Internal] Number of unread notifications
- `notification` - One specific notification
- `notificationSubscriptions` - The user's notification subscriptions
- `notificationSubscription` - One specific notification subscription

### Integrations
- `integrations` - All integrations
- `integration` - One specific integration
- `integrationsSettings` - One specific set of settings
- `integrationTemplates` - Template and integration connections
- `integrationTemplate` - One specific integrationTemplate
- `integrationHasScopes` - Checks if integration has all required scopes
- `verifyGitHubEnterpriseServerInstallation` - Verify GitHub Enterprise Server response
- `templatesForIntegration` - Returns templates associated with an integration type

### Workflows
- `workflowStates` - All issue workflow states
- `workflowState` - One specific state

### Webhooks
- `webhooks` - All webhooks
- `webhook` - A specific webhook
- `failuresForOauthWebhooks` - [INTERNAL] Webhook failure events for OAuth apps (last 50)

### Documents
- `documents` - All documents in the workspace
- `document` - One specific document
- `documentContentHistory` - A collection of document content history entries
- `searchDocuments` - Search documents

### Templates
- `templates` - All templates from all users
- `template` - A specific template

### Favorites
- `favorites` - The user's favorites
- `favorite` - One specific favorite

### Attachments
- `attachments` - All issue attachments
- `attachment` - One specific issue attachment
- `attachmentsForURL` - Returns issue attachments for a given URL
- `attachmentSources` - [Internal] Unique attachment sources in the workspace

### Customers (CRM)
- `customers` - All customers
- `customer` - One specific customer
- `customerNeeds` - All customer needs
- `customerNeed` - One specific customer need
- `customerStatuses` - All customer statuses
- `customerStatus` - One specific customer status
- `customerTiers` - All customer tiers
- `customerTier` - One specific customer tier

### Initiatives (Strategic Planning)
- `initiatives` - All initiatives in the workspace
- `initiative` - One specific initiative
- `initiativeUpdates` - All initiative updates
- `initiativeUpdate` - A specific initiative update
- `initiativeRelations` - All initiative relationships
- `initiativeRelation` - One specific initiative relation
- `initiativeToProjects` - Returns list of initiative to project entities
- `initiativeToProject` - One specific initiativeToProject

### Search & AI
- `semanticSearch` - Search for resources using natural language
- `searchProjects` - Search projects
- `projectFilterSuggestion` - Suggests project view filters based on text prompt
- `issueFilterSuggestion` - Suggests issue view filters based on text prompt
- `issueTitleSuggestionFromCustomerRequest` - Suggests issue title based on customer request

### Agent Operations
- `agentSessions` - All agent sessions
- `agentSession` - A specific agent session
- `agentActivities` - All agent activities
- `agentActivity` - A specific agent activity

### Other
- `userSettings` - The user's settings
- `triageResponsibilities` - All triage responsibilities
- `triageResponsibility` - A specific triage responsibility
- `timeSchedules` - All time schedules
- `timeSchedule` - A specific time schedule
- `rateLimitStatus` - The status of the rate limiter
- `pushSubscriptionTest` - Sends a test push message
- `customViews` - Custom views for the user
- `customView` - One specific custom view
- `customViewDetailsSuggestion` - [INTERNAL] Suggests metadata for a view
- `customViewHasSubscribers` - Whether a custom view has other subscribers
- `emailIntakeAddress` - One specific email intake address
- `auditEntryTypes` - List of audit entry types
- `auditEntries` - All audit log entries
- `authenticationSessions` - User's active sessions
- `ssoUrlFromEmail` - Fetch SSO login URL for an email
- `applicationInfo` - Get basic information for an application
- `emojis` - All custom emojis
- `emoji` - A specific emoji
- `entityExternalLink` - One specific entity link
- `fetchData` - [Internal] Fetch arbitrary data using natural language query

## Mutation Operations

### Issue Management
- `issueCreate` - Creates a new issue
- `issueBatchCreate` - Creates a list of issues in one transaction
- `issueUpdate` - Updates an issue
- `issueBatchUpdate` - Updates multiple issues at once
- `issueArchive` - Archives an issue
- `issueUnarchive` - Unarchives an issue
- `issueDelete` - Deletes (trashes) an issue

### Issue Labels & Relations
- `issueAddLabel` - Adds a label to an issue
- `issueRemoveLabel` - Removes a label from an issue
- `issueLabelCreate` - Creates a new label
- `issueLabelUpdate` - Updates a label
- `issueLabelDelete` - Deletes an issue label
- `issueLabelRetire` - Retires a label
- `issueLabelRestore` - Restores a label

### Issue Relationships & Metadata
- `issueRelationCreate` - Creates a new issue relation
- `issueRelationUpdate` - Updates an issue relation
- `issueRelationDelete` - Deletes an issue relation
- `issueReminder` - Adds an issue reminder (sends notification at specified time)
- `issueSubscribe` - Subscribes a user to an issue
- `issueUnsubscribe` - Unsubscribes a user from an issue

### Issue Sync & Integration
- `issueExternalSyncDisable` - Disables external sync on an issue
- `issueDescriptionUpdateFromFront` - [INTERNAL] Updates issue description from Front app
- `issueImportCreateGithub` - Kicks off a GitHub import job
- `issueImportCreateJira` - Kicks off a Jira import job
- `issueImportCreateCSVJira` - Kicks off a Jira import from CSV
- `issueImportCreateClubhouse` - Kicks off a Shortcut (Clubhouse) import job
- `issueImportCreateAsana` - Kicks off an Asana import job
- `issueImportCreateLinearV2` - [INTERNAL] Kicks off a Linear to Linear import job
- `issueImportDelete` - Deletes an import job
- `issueImportProcess` - Kicks off import processing
- `issueImportUpdate` - Updates the mapping for issue import

### Comments
- `commentCreate` - Creates a new comment
- `commentUpdate` - Updates a comment
- `commentDelete` - Deletes a comment
- `commentResolve` - Resolves a comment
- `commentUnresolve` - Unresolves a comment

### Projects
- `projectCreate` - Creates a new project
- `projectUpdate` - Updates a project
- `projectReassignStatus` - [INTERNAL] Updates all projects assigned to a project status
- `projectDelete` - Deletes (trashes) a project
- `projectUnarchive` - Unarchives a project
- `projectAddLabel` - Adds a label to a project
- `projectRemoveLabel` - Removes a label from a project

### Project Updates & Milestones
- `projectUpdateCreate` - Creates a new project update
- `projectUpdateUpdate` - Updates a project update
- `projectUpdateArchive` - Archives a project update
- `projectUpdateUnarchive` - Unarchives a project update
- `createProjectUpdateReminder` - Create reminder for a project update
- `projectMilestoneCreate` - Creates a new project milestone
- `projectMilestoneUpdate` - Updates a project milestone
- `projectMilestoneDelete` - Deletes a project milestone
- `projectMilestoneMove` - [Internal] Moves a project milestone to another project

### Project Statuses & Labels
- `projectStatusCreate` - Creates a new project status
- `projectStatusUpdate` - Updates a project status
- `projectStatusArchive` - Archives a project status
- `projectStatusUnarchive` - Unarchives a project status
- `projectLabelCreate` - Creates a new project label
- `projectLabelUpdate` - Updates a project label
- `projectLabelDelete` - Deletes a project label
- `projectLabelRetire` - Retires a project label
- `projectLabelRestore` - Restores a project label

### Project Relations
- `projectRelationCreate` - Creates a new project relation
- `projectRelationUpdate` - Updates a project relation
- `projectRelationDelete` - Deletes a project relation

### Teams
- `teamCreate` - Creates a new team
- `teamUpdate` - Updates a team
- `teamDelete` - Deletes a team
- `teamUnarchive` - Unarchives a team and cancels deletion
- `teamCyclesDelete` - Deletes team's cycles data
- `teamMembershipCreate` - Creates a new team membership
- `teamMembershipUpdate` - Updates a team membership
- `teamMembershipDelete` - Deletes a team membership
- `teamKeyDelete` - Deletes a previously used team key

### Workflows
- `workflowStateCreate` - Creates a new state in a team's workflow
- `workflowStateUpdate` - Updates a state
- `workflowStateArchive` - Archives a state

### Cycles
- `cycleCreate` - Creates a new cycle
- `cycleUpdate` - Updates a cycle
- `cycleArchive` - Archives a cycle
- `cycleShiftAll` - Shifts all cycles start/end by a number of days
- `cycleStartUpcomingCycleToday` - Starts the upcoming cycle

### Organization
- `organizationUpdate` - Updates the user's organization
- `organizationDeleteChallenge` - Get organization delete confirmation token
- `organizationDelete` - Deletes an organization
- `organizationCancelDelete` - Cancels organization deletion
- `organizationStartTrialForPlan` - Starts a trial for specified plan type
- `organizationInviteCreate` - Creates a new organization invite
- `organizationInviteUpdate` - Updates an organization invite
- `resendOrganizationInvite` - Re-sends an organization invite
- `resendOrganizationInviteByEmail` - Re-sends invite tied to an email
- `organizationInviteDelete` - Deletes an organization invite
- `organizationDomainClaim` - [INTERNAL] Verifies a domain claim
- `organizationDomainVerify` - [INTERNAL] Verifies a domain to be added
- `organizationDomainCreate` - [INTERNAL] Adds a domain for organization
- `organizationDomainUpdate` - [INTERNAL] Updates organization domain settings
- `organizationDomainDelete` - Deletes a domain

### Users
- `userUpdate` - Updates a user (admin or self only)
- `userChangeRole` - Changes role of a user
- `userSuspend` - Suspends a user
- `userUnsuspend` - Un-suspends a user
- `userUnlinkFromIdentityProvider` - Unlinks guest user from identity provider
- `userSettingsUpdate` - Updates the user's settings
- `userSettingsFlagsReset` - Resets user's setting flags
- `userFlagUpdate` - Updates a user's settings flag
- `userDiscordConnect` - Connects Discord user to Linear account via OAuth2
- `userExternalUserDisconnect` - Disconnects external user from Linear account

### Notifications
- `notificationUpdate` - Updates a notification
- `notificationMarkReadAll` - Marks notification and all related as read
- `notificationMarkUnreadAll` - Marks notification and all related as unread
- `notificationSnoozeAll` - Snoozes a notification and all related
- `notificationUnsnoozeAll` - Unsnoozes a notification and all related
- `notificationArchive` - Archives a notification
- `notificationArchiveAll` - Archives notification and all related
- `notificationUnarchive` - Unarchives a notification
- `notificationCategoryChannelSubscriptionUpdate` - Subscribe/unsubscribe from notification category

### Subscriptions
- `notificationSubscriptionCreate` - Creates notification subscription
- `notificationSubscriptionUpdate` - Updates notification subscription
- `pushSubscriptionCreate` - Creates a push subscription
- `pushSubscriptionDelete` - Deletes a push subscription

### Documents
- `documentCreate` - Creates a new document
- `documentUpdate` - Updates a document
- `documentDelete` - Deletes (trashes) a document
- `documentUnarchive` - Restores a document

### Templates & Triage
- `templateCreate` - Creates a new template
- `templateUpdate` - Updates an existing template
- `templateDelete` - Deletes a template
- `triageResponsibilityCreate` - Creates a new triage responsibility
- `triageResponsibilityUpdate` - Updates triage responsibility
- `triageResponsibilityDelete` - Deletes triage responsibility

### Webhooks
- `webhookCreate` - Creates a new webhook
- `webhookUpdate` - Updates an existing webhook
- `webhookDelete` - Deletes a webhook

### Integrations - GitHub
- `integrationGithubCommitCreate` - Generates webhook for GitHub commit integration
- `integrationGithubConnect` - Connects organization with GitHub App
- `integrationGithubImportConnect` - Connects organization with GitHub Import App
- `integrationGithubImportRefresh` - Refreshes GitHub import data
- `integrationGitHubEnterpriseServerConnect` - Connects with GitHub Enterprise Server
- `integrationGitHubPersonal` - Connect personal GitHub account to Linear

### Integrations - Other VCS
- `integrationGitlabConnect` - Connects with GitLab Access Token
- `airbyteIntegrationConnect` - Creates API key for Airbyte integration

### Integrations - Communication & Monitoring
- `integrationSlack` - Integrates organization with Slack
- `integrationSlackAsks` - Integrates with Slack Asks app
- `integrationSlackPersonal` - Integrates personal notifications with Slack
- `integrationSlackPost` - Slack integration for team notifications
- `integrationSlackProjectPost` - Slack integration for project notifications
- `integrationSlackInitiativePost` - [Internal] Slack for initiative notifications
- `integrationSlackCustomViewNotifications` - Slack for custom view notifications
- `integrationSlackCustomerChannelLink` - Link Slack Asks channel with Customer
- `integrationSlackOrgProjectUpdatesPost` - Slack for org-level project updates
- `integrationSlackOrgInitiativeUpdatesPost` - [Internal] Slack for org-level initiative updates
- `integrationSlackImportEmojis` - Import custom emojis from Slack
- `integrationAsksConnectChannel` - Connect Slack channel to Asks
- `updateIntegrationSlackScopes` - [Internal] Update Slack integration scopes
- `integrationDiscord` - Integrates with Discord
- `integrationIntercom` - Integrates with Intercom
- `integrationIntercomDelete` - Disconnects from Intercom
- `integrationFront` - Integrates with Front
- `integrationZendesk` - Integrates with Zendesk

### Integrations - Development Tools
- `integrationFigma` - Integrates with Figma
- `integrationSentry` - Integrates with Sentry
- `jiraIntegrationConnect` - [INTERNAL] Connects with Jira Personal Access Token
- `integrationJiraUpdate` - [INTERNAL] Updates Jira Integration
- `integrationJiraPersonal` - Connect personal Jira account to Linear

### Integrations - Operations & CRM
- `integrationLaunchDarklyConnect` - [INTERNAL] Integrates with LaunchDarkly
- `integrationLaunchDarklyPersonalConnect` - [INTERNAL] Personal LaunchDarkly integration
- `integrationOpsgenieConnect` - [INTERNAL] Integrates with Opsgenie
- `integrationOpsgenieRefreshScheduleMappings` - [INTERNAL] Refresh Opsgenie mappings
- `integrationPagerDutyConnect` - [INTERNAL] Integrates with PagerDuty
- `integrationPagerDutyRefreshScheduleMappings` - [INTERNAL] Refresh PagerDuty mappings
- `integrationGong` - Integrates with Gong
- `integrationGoogleCalendarPersonalConnect` - [Internal] Connect Google Calendar via OAuth2
- `integrationGoogleSheets` - Integrates with Google Sheets
- `refreshGoogleSheetsData` - Manually update Google Sheets data
- `integrationSalesforce` - Integrates with Salesforce
- `integrationSalesforceMetadataRefresh` - [INTERNAL] Refresh Salesforce metadata
- `integrationCustomerDataAttributesRefresh` - [INTERNAL] Refresh customer data attributes

### Integrations - MCP & Management
- `integrationMcpServerPersonalConnect` - [INTERNAL] Connect with MCP server
- `integrationUpdate` - [INTERNAL] Updates the integration
- `integrationDelete` - Deletes an integration
- `integrationArchive` - Archives an integration
- `integrationRequest` - Requests unavailable integration

### Integrations - Settings & Templates
- `integrationsSettingsCreate` - Creates new settings for integrations
- `integrationsSettingsUpdate` - Updates integration settings for project/team
- `integrationTemplateCreate` - Creates new integrationTemplate join
- `integrationTemplateDelete` - Deletes integrationTemplate

### Custom Views & Favorites
- `customViewCreate` - Creates a new custom view
- `customViewUpdate` - Updates a custom view
- `customViewDelete` - Deletes a custom view
- `favoriteCreate` - Creates a new favorite
- `favoriteUpdate` - Updates a favorite
- `favoriteDelete` - Deletes a favorite reference
- `viewPreferencesCreate` - Creates new ViewPreferences
- `viewPreferencesUpdate` - Updates existing ViewPreferences
- `viewPreferencesDelete` - Deletes ViewPreferences

### Attachments & Linking
- `attachmentCreate` - Creates attachment or updates if same URL/issueId
- `attachmentUpdate` - Updates existing issue attachment
- `attachmentLinkURL` - Link any URL to an issue
- `attachmentLinkGitLabMR` - Link GitLab MR to an issue
- `attachmentLinkGitHubIssue` - Link GitHub issue to Linear issue
- `attachmentLinkGitHubPR` - Link GitHub PR to Linear issue
- `attachmentLinkZendesk` - Link Zendesk ticket to an issue
- `attachmentLinkDiscord` - Link Discord message to an issue
- `attachmentSyncToSlack` - Begin syncing Slack thread with comment thread
- `attachmentLinkSlack` - Link Slack message to an issue
- `attachmentLinkFront` - Link Front conversation to an issue
- `attachmentLinkIntercom` - Link Intercom conversation to an issue
- `attachmentLinkJiraIssue` - Link Jira issue to Linear issue
- `attachmentLinkSalesforce` - Link Salesforce case to an issue
- `attachmentDelete` - Deletes issue attachment

### Customers & Needs (CRM)
- `customerCreate` - Creates a new customer
- `customerUpdate` - Updates a customer
- `customerDelete` - Deletes a customer
- `customerMerge` - Merges two customers
- `customerUpsert` - Upserts customer (creates or updates)
- `customerUnsync` - Unsyncs customer from data source
- `customerTierCreate` - Creates new customer tier
- `customerTierUpdate` - Updates customer tier
- `customerTierDelete` - Deletes customer tier
- `customerStatusCreate` - Creates new customer status
- `customerStatusUpdate` - Updates customer status
- `customerStatusDelete` - Deletes customer status
- `customerNeedCreate` - Creates new customer need
- `customerNeedCreateFromAttachment` - Creates customer need from attachment
- `customerNeedUpdate` - Updates customer need
- `customerNeedDelete` - Deletes customer need
- `customerNeedArchive` - Archives customer need
- `customerNeedUnarchive` - Unarchives customer need

### Initiatives (Strategic Planning)
- `initiativeCreate` - Creates a new initiative
- `initiativeUpdate` - Updates an initiative
- `initiativeArchive` - Archives an initiative
- `initiativeUnarchive` - Unarchives an initiative
- `initiativeDelete` - Deletes (trashes) an initiative
- `initiativeRelationCreate` - Creates new initiative relation
- `initiativeRelationUpdate` - Updates initiative relation
- `initiativeRelationDelete` - Deletes initiative relation
- `initiativeUpdateCreate` - Creates an initiative update
- `initiativeUpdateUpdate` - Updates an update
- `initiativeUpdateArchive` - Archives an initiative update
- `initiativeUpdateUnarchive` - Unarchives an initiative update
- `createInitiativeUpdateReminder` - Create reminder for initiative update
- `initiativeToProjectCreate` - Creates new initiativeToProject join
- `initiativeToProjectUpdate` - Updates initiativeToProject
- `initiativeToProjectDelete` - Deletes initiativeToProject

### Git Automation
- `gitAutomationTargetBranchCreate` - Creates Git target branch automation
- `gitAutomationTargetBranchUpdate` - Updates Git target branch automation
- `gitAutomationTargetBranchDelete` - Archives Git target branch automation
- `gitAutomationStateCreate` - Creates new automation state
- `gitAutomationStateUpdate` - Updates automation state
- `gitAutomationStateDelete` - Archives automation state

### File & Data Management
- `fileUpload` - XHR upload for images, video, and attachments
- `importFileUpload` - XHR upload for import files
- `imageUploadFromUrl` - Upload image from URL
- `fileUploadDangerouslyDelete` - [INTERNAL] Permanently delete uploaded file
- `createCsvExportReport` - Create CSV export report
- `entityExternalLinkCreate` - Creates new entity link
- `entityExternalLinkUpdate` - Updates entity link
- `entityExternalLinkDelete` - Deletes entity link

### Reactions & Emojis
- `reactionCreate` - Creates a new reaction
- `reactionDelete` - Deletes a reaction
- `emojiCreate` - Creates custom emoji
- `emojiDelete` - Deletes emoji

### Email & Communication
- `emailUnsubscribe` - Unsubscribes from email type
- `emailIntakeAddressCreate` - Creates email intake address
- `emailIntakeAddressRotate` - Rotates email intake address
- `emailIntakeAddressUpdate` - Updates email intake address
- `emailIntakeAddressDelete` - Deletes email intake address

### Time Schedules
- `timeScheduleCreate` - Creates new time schedule
- `timeScheduleUpdate` - Updates time schedule
- `timeScheduleUpsertExternal` - Upsert external time schedule
- `timeScheduleDelete` - Deletes time schedule
- `timeScheduleRefreshIntegrationSchedule` - Refresh integration schedule info
- `roadmapToProjectCreate` - Creates new roadmapToProject join
- `roadmapToProjectUpdate` - Updates roadmapToProject
- `roadmapToProjectDelete` - Deletes roadmapToProject

### Agents (AI)
- `agentSessionCreateOnComment` - Creates agent session on comment
- `agentSessionCreateOnIssue` - Creates agent session on issue
- `agentSessionCreate` - [Internal] Creates agent session
- `agentSessionUpdateExternalUrl` - Updates agent session external URL
- `agentSessionUpdate` - Updates agent session
- `agentActivityCreate` - Creates agent activity
- `agentActivityCreatePrompt` - [Internal] Creates prompt agent activity

### Authentication & Sessions
- `emailUserAccountAuthChallenge` - Find/create user by email and send auth token
- `emailTokenUserAccountAuth` - Authenticate via email and token
- `samlTokenUserAccountAuth` - Authenticate via SAML token
- `googleUserAccountAuth` - Authenticate via Google OAuth
- `passkeyLoginStart` - [INTERNAL] Start passkey login
- `passkeyLoginFinish` - [INTERNAL] Finish passkey login
- `createOrganizationFromOnboarding` - Create organization during onboarding
- `joinOrganizationFromOnboarding` - Join organization during onboarding
- `leaveOrganization` - Leave an organization
- `logout` - Logout the client
- `logoutSession` - Logout individual session
- `logoutAllSessions` - Logout all sessions including active
- `logoutOtherSessions` - Logout all sessions except current

## Issue Type Fields (Detailed)

The `Issue` type includes 80+ fields covering all aspects of issue management:

### Core Identity
- `id` (ID!) - Unique identifier
- `identifier` (String!) - Human-readable identifier (e.g., "LIN-123")
- `number` (Int!) - Issue number within team
- `title` (String!) - Issue title
- `url` (String!) - Full URL to issue
- `branchName` (String!) - Suggested git branch name

### Description & Documentation
- `description` (String) - Issue description (markdown)
- `descriptionState` (String) - Description state format
- `documentContent` (DocumentContent) - Full document content object

### Timestamps
- `createdAt` (DateTime!) - When issue was created
- `updatedAt` (DateTime!) - When issue was last updated
- `archivedAt` (DateTime) - When issue was archived
- `startedAt` (DateTime) - When issue was started
- `completedAt` (DateTime) - When issue was completed
- `startedTriageAt` (DateTime) - When triage started
- `triagedAt` (DateTime) - When issue was triaged
- `canceledAt` (DateTime) - When issue was canceled
- `autoClosedAt` (DateTime) - When auto-closed
- `autoArchivedAt` (DateTime) - When auto-archived
- `dueDate` (TimelessDate) - Due date (date only, no time)
- `snoozedUntilAt` (DateTime) - Until when issue is snoozed
- `addedToProjectAt` (DateTime) - When added to project
- `addedToCycleAt` (DateTime) - When added to cycle
- `addedToTeamAt` (DateTime) - When added to team

### Priority & Effort
- `priority` (Int!) - Numeric priority value
- `priorityLabel` (String!) - Human-readable priority label
- `estimate` (Float) - Story points or time estimate
- `sortOrder` (Float!) - Sort order within team
- `prioritySortOrder` (Float!) - Sort order by priority

### Status & Workflow
- `state` (WorkflowState!) - Current workflow state
- `trashed` (Boolean) - Whether issue is in trash

### SLA Tracking
- `slaStartedAt` (DateTime) - When SLA started
- `slaMediumRiskAt` (DateTime) - Medium risk threshold
- `slaHighRiskAt` (DateTime) - High risk threshold
- `slaBreachesAt` (DateTime) - When SLA breaches
- `slaType` (String) - Type of SLA

### Relationships - People
- `assignee` (User) - Assigned to user
- `creator` (User) - User who created
- `externalUserCreator` (ExternalUser) - External user creator
- `delegate` (User) - User delegated to
- `snoozedBy` (User) - User who snoozed
- `asksRequester` (User) - Requester in Asks
- `asksExternalUserRequester` (ExternalUser) - External requester

### Relationships - Hierarchy
- `team` (Team!) - Team that owns issue
- `project` (Project) - Associated project
- `cycle` (Cycle) - Associated cycle
- `parent` (Issue) - Parent issue (for sub-issues)
- `children` ([Issue!]!) - Child issues
- `projectMilestone` (ProjectMilestone) - Associated milestone

### Related Data
- `labels` ([IssueLabel!]!) - Associated labels
- `labelIds` ([String!]!) - Label IDs
- `comments` ([Comment!]!) - Comments on issue
- `attachments` ([Attachment!]!) - Attachments
- `formerAttachments` ([Attachment!]!) - Removed attachments
- `relations` ([IssueRelation!]!) - Issue relations
- `inverseRelations` ([IssueRelation!]!) - Incoming relations
- `history` ([IssueHistory!]!) - Activity history
- `subscribers` ([User!]!) - Subscribed users
- `reactions` ([Reaction!]!) - Emoji reactions
- `needs` ([CustomerNeed!]!) - Related customer needs
- `formerNeeds` ([CustomerNeed!]!) - Former customer needs
- `documents` ([Document!]!) - Related documents
- `suggestions` ([IssueSuggestion!]!) - AI suggestions
- `incomingSuggestions` ([IssueSuggestion!]!) - Incoming suggestions

### External Sync
- `syncedWith` ([ExternalIssue]) - External issue syncs
- `integrationSourceType` (IntegrationService) - Source integration type

### Templates & Automation
- `lastAppliedTemplate` (Template) - Last template applied
- `recurringIssueTemplate` (Template) - Recurring template

### Activity & Engagement
- `activitySummary` (JSONObject) - Activity summary data
- `reactionData` (JSONObject!) - Reaction data
- `suggestionsGeneratedAt` (DateTime) - When suggestions generated
- `subIssueSortOrder` (Float) - Sort order for sub-issues

### Metadata
- `customerTicketCount` (Int!) - Count of customer tickets
- `previousIdentifiers` ([String!]!) - Former identifiers
- `sourceComment` (Comment) - Source comment
- `botActor` (ActorBot) - Bot that created issue
- `favorite` (Favorite) - User's favorite marker

## Integration Support

Linear supports extensive integration with:

### Version Control
- GitHub (Cloud & Enterprise)
- GitLab

### Communication
- Slack
- Discord
- Intercom
- Front
- Zendesk

### Development & Monitoring
- Figma
- Sentry
- GitHub (Sync)
- Airbyte
- LaunchDarkly
- Gong
- Google Sheets

### Operations & Incident Management
- PagerDuty
- Opsgenie

### CRM & Sales
- Salesforce
- Intercom

### Project Management (Import)
- GitHub Issues
- Jira
- Asana
- Shortcut (formerly Clubhouse)

## Rate Limiting & Complexity

The API uses complexity-based rate limiting:
- **Introspection queries**: Subject to complexity limits (~10,000 complexity max)
- **Full schema introspection**: May need to be done in smaller pieces
- **Rate Limit Status**: Available via `rateLimitStatus` query

## Authentication

- **Public Introspection**: Schema introspection is publicly available without auth
- **Data Access**: Requires API token in Authorization header
- **OAuth**: Supported for user account integrations
- **SAML**: Supported for enterprise
- **Passkeys**: Supported for newer implementations

## Notable Features

### Advanced Search
- Natural language semantic search
- Filter suggestions based on text prompts
- Custom queries with complexity scoring

### Batch Operations
- Batch issue creation
- Batch issue updates
- Efficient bulk changes

### AI & Agent Support
- Agent sessions for issues and comments
- Agent activities and tracking
- Semantic search capabilities

### Strategic Planning
- Initiatives (roadmap-level planning)
- Initiative relations and project connections
- Initiative updates with timeline tracking

### Customer Management (CRM)
- Customers with multiple tiers/statuses
- Customer needs tracking
- Attachment-based need creation
- Customer data synchronization

### Document Management
- Rich document editing
- Document history tracking
- Document linking to issues

### Webhooks & Real-time
- Webhook management
- Failure tracking for OAuth webhooks
- Push subscriptions

### Audit & Compliance
- Audit entry logs
- Audit entry types
- Session management and logout control

## File Structure

This documentation is organized as follows:

- **SCHEMA.md** - Complete API schema reference (this file)
- **OPERATIONS.md** - Detailed categorized operation reference
- **TYPES.md** - Common type definitions and structures
- **EXAMPLES.md** - Query and mutation examples
- **INTEGRATION_GUIDE.md** - Integration-specific setup and configuration
