
# Admin Access Flow & Logout Improvements

## Overview

This plan enhances the Admin access experience with proper authentication redirects, a clean "Not Authorized" page for non-admin users, and persistent navigation controls (Back to Dashboard, Go to Website, Log out) in the Admin panel.

---

## Current State Analysis

**ProtectedAdminRoute.tsx**:
- Redirects unauthenticated users to `/auth` (no return URL)
- Silently redirects denied users to `/dashboard` with only a toast notification

**AdminLayout.tsx**:
- No persistent navigation controls for Dashboard/Website/Logout
- Sidebar only contains admin module links

**Auth.tsx**:
- Redirects authenticated users to `/dashboard` only
- Does not support `?next=` parameter for post-login redirects

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        /admin Route                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             ProtectedAdminRoute (Updated)                │   │
│  │                                                          │   │
│  │  ┌─────────────┐    ┌────────────────────┐              │   │
│  │  │ No Session? │───►│ /auth?next=/admin  │              │   │
│  │  └─────────────┘    └────────────────────┘              │   │
│  │         │                                                │   │
│  │         ▼                                                │   │
│  │  ┌─────────────┐    ┌────────────────────┐              │   │
│  │  │ Not Admin?  │───►│ AdminAccessDenied  │              │   │
│  │  └─────────────┘    │ (inline component) │              │   │
│  │         │           └────────────────────┘              │   │
│  │         ▼                                                │   │
│  │  ┌─────────────┐    ┌────────────────────┐              │   │
│  │  │   Admin?    │───►│ Outlet (AdminLayout)│              │   │
│  │  └─────────────┘    └────────────────────┘              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     AdminLayout (Updated)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Admin Top Bar                          │  │
│  │  ┌──────────────┐ ┌───────────────┐ ┌─────────────────┐  │  │
│  │  │ Back to      │ │ Go to Website │ │ Log out         │  │  │
│  │  │ Dashboard    │ │      /        │ │ (signs out →/)  │  │  │
│  │  └──────────────┘ └───────────────┘ └─────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐   ┌───────────────────────────────────────┐  │
│  │   Sidebar    │   │           Main Content                 │  │
│  │              │   │                                        │  │
│  │   Overview   │   │   <Outlet /> (admin pages)             │  │
│  │   Customers  │   │                                        │  │
│  │   Orders     │   │                                        │  │
│  │   ...        │   │                                        │  │
│  │              │   │                                        │  │
│  └──────────────┘   └───────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Changes

### 1. Update Auth.tsx - Support `?next=` Parameter

**File**: `src/pages/Auth.tsx`

**Changes**:
- Parse `next` query parameter from URL
- After successful login, redirect to `next` value if present (and valid), otherwise `/dashboard`
- Validate that `next` is a relative URL (security: prevent open redirects)

**Key Logic**:
```typescript
const nextUrl = searchParams.get("next");

// On successful auth:
const redirectTo = nextUrl && nextUrl.startsWith("/") ? nextUrl : "/dashboard";
navigate(redirectTo);
```

---

### 2. Update ProtectedAdminRoute.tsx - Improved Flow

**File**: `src/components/admin/layout/ProtectedAdminRoute.tsx`

**Changes**:
- Redirect unauthenticated users to `/auth?next=/admin/overview`
- For denied users: render an inline "Access Denied" component instead of silent redirect
- Access Denied page includes:
  - Clear message explaining lack of admin permissions
  - "Back to Dashboard" button
  - "Go to Home" button
  - OCCTA brutalist styling

**Access Denied Component Design**:
```
┌──────────────────────────────────────────────┐
│                                              │
│              🚫                              │
│                                              │
│        NOT AUTHORISED                        │
│                                              │
│   You don't have permission to access        │
│   the admin console.                         │
│                                              │
│   ┌────────────────┐  ┌─────────────────┐   │
│   │ Back to        │  │ Go to Home      │   │
│   │ Dashboard      │  │                 │   │
│   └────────────────┘  └─────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

---

### 3. Update AdminLayout.tsx - Add Persistent Top Bar

**File**: `src/components/admin/layout/AdminLayout.tsx`

**Changes**:
- Add a persistent top bar above the existing header
- Top bar contains three action buttons:
  - **Back to Dashboard** → navigates to `/dashboard`
  - **Go to Website** → navigates to `/`
  - **Log out** → calls `supabase.auth.signOut()` and redirects to `/`
- Style consistent with OCCTA brutalist design (border-4, monochrome)

**Layout Structure**:
```jsx
<div className="min-h-screen bg-background">
  {/* NEW: Persistent Admin Top Bar */}
  <div className="border-b-4 border-foreground bg-muted/50 px-4 py-2">
    <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
      <span className="text-sm text-muted-foreground">
        Admin Console
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <LayoutDashboard className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ExternalLink className="w-4 h-4 mr-2" />
          Website
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </Button>
      </div>
    </div>
  </div>
  
  {/* Existing layout... */}
</div>
```

---

### 4. Update AdminOverview.tsx - Add Tip Text

**File**: `src/pages/admin/Overview.tsx`

**Changes**:
- Add a subtle tip below the page description
- Text: "Tip: bookmark /admin for direct admin access."

**Implementation**:
```jsx
<div>
  <h1 className="text-2xl font-display">Operations Dashboard</h1>
  <p className="text-muted-foreground">
    Daily work queues and actionable items for the admin team.
  </p>
  <p className="text-xs text-muted-foreground mt-2">
    💡 Tip: bookmark <code className="bg-muted px-1 py-0.5">/admin</code> for direct admin access.
  </p>
</div>
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/Auth.tsx` | Modify | Add `?next=` redirect support |
| `src/components/admin/layout/ProtectedAdminRoute.tsx` | Modify | Add inline AccessDenied component, update redirect |
| `src/components/admin/layout/AdminLayout.tsx` | Modify | Add persistent top bar with nav actions |
| `src/pages/admin/Overview.tsx` | Modify | Add bookmark tip text |

---

## Technical Notes

### Security: Preventing Open Redirects
The `next` parameter is validated to ensure it:
1. Starts with `/` (relative URL only)
2. Does not contain `//` (prevents protocol-relative URLs)

### No Breaking Changes
- Existing billing logic, invoice generation, and database schema remain untouched
- Existing navigation flow (Home → Auth → Dashboard → Admin) continues to work
- All admin module routes remain unchanged

### Styling Compliance
- Top bar uses `border-b-4 border-foreground` for brutalist consistency
- Buttons use `variant="ghost"` to keep focus on content
- Access Denied page uses sharp borders and bold typography
