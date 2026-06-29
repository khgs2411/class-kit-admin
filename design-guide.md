# Admin Demo Design Guide

`class-kit-demo` is the platform admin control panel. It is not a client-facing website and it is not a mobile-first app. Treat it as a desktop operations tool for managing every product, customer, origin, role, user, and product-level issue under platform control.

The admin app should feel minimal, fast, precise, and trustworthy. It should never feel like a marketing site, a generic SaaS dashboard template, or a raw database console.

## Product Purpose

The admin control panel is where a Class Kit operator can:

- Select any product under platform control.
- Inspect product health and configuration.
- Manage users, product roles, permissions, origins, and auth policy.
- Help a customer fix product-local issues without entering their client-facing website.

The operator will use this on desktop. Optimize for full-page utilization, scanability, low-friction editing, and fast switching between products and tasks.

## Surface Model

Admin has one primary surface: the desktop control panel. It still has layers of focus:

1. **Platform shell**: session state, global product count, selected product, and admin access.
2. **Product rail**: choose the customer/product first. Product selection is the outer navigation boundary.
3. **Product task tabs**: choose the task for the selected product, such as Users, Roles & permissions, or Settings.
4. **Task drill-down**: choose the item being edited, then choose the category or mode when the item has grouped details.
5. **Focused editor**: edit only the currently selected category, user, role, origin, or policy area.

Do not collapse these layers into one large scrolling form. The admin app should let the operator know exactly where they are: product, task, object, category.

## Workflow Depth

Use the same progressive-disclosure rule as the demo2 Dashboard, but with product selection as the outer rail.

Default admin workflow:

1. Choose product.
2. Choose product task.
3. Choose primary object.
4. Choose object category or mode.
5. Edit only that focused category.

For Roles & permissions, the workflow is:

1. Choose product.
2. Choose Roles & permissions.
3. Choose role.
4. Choose permission category.
5. Edit only that category's permissions.

Apply this pattern anywhere the data has a natural hierarchy: product users and their role grants, product settings and auth/origin groups, schedules and generated classes, registrations and approval states, memberships and grants. Prefer rails, tabs, segmented controls, and master-detail layouts over all-in-one pages.

## Layout

Admin is desktop-first.

- Use the full viewport width. Do not constrain the app to a marketing-page max width.
- Keep the product rail visible and stable on desktop.
- Keep selected product context visible above task content.
- Keep task tabs compact and close to the selected product context.
- Use internal scrolling inside long work areas when it helps preserve product and task context.
- Prefer two- and three-column operational layouts over stacked vertical forms.
- Keep important actions near the data they affect.
- Avoid giant page titles and explanatory blocks. The operator already knows they are in the admin panel.

Good admin structure:

- Header metrics for global state.
- Product rail for customer switching.
- Product detail summary for selected product.
- Task tab set.
- Task workspace with rails and focused editor.

Bad admin structure:

- Centered narrow pages on desktop.
- Long forms showing every field and permission group at once.
- Marketing-style hero sections.
- Cards nested inside cards.
- Large blank bands above the active work.
- Modals for ordinary drill-down when inline master-detail would be faster.

## Visual Language

The admin app should be restrained and utilitarian.

- Use the existing light token system in `src/index.css`.
- Prefer white and near-white surfaces, thin borders, and black primary actions.
- Use compact 8px radii or smaller unless an existing primitive requires otherwise.
- Use clear active states with border, background, or inset markers.
- Keep typography small, strong, and readable.
- Use badges sparingly for status, role type, and product state.
- Use `lucide-react` icons for recognizable actions.
- Avoid decorative imagery, gradients, glass effects, large shadows, and brand-heavy styling.

The admin app can be polished without being pretty for its own sake. Visual polish should reduce cognitive load.

## Interaction Rules

- Every destructive action must be deliberate and visibly different from normal actions.
- Every save action should clearly indicate what object it affects.
- Inline edits are preferred when the user is editing the currently selected object.
- Use dialogs for creation flows, confirmations, or side tasks that would interrupt the active workspace.
- Keep disabled states explicit and explain the reason when the operator can fix it.
- Use human labels and descriptions for permissions. Do not expose permission keys as the primary label.
- Use human names and emails for users. Do not expose raw Supabase IDs as primary identity.
- Copyable IDs are useful as secondary metadata.
- Refresh actions should preserve the selected product, task, role, and category when possible.

## Product Boundaries

Admin can manage every product, but product security and authority stay in the backend.

- Website layer (`app/demo`) owns admin layout, copy, density, and interaction polish.
- SDK/client facade (`packages/react`) owns typed admin methods and response normalization.
- Backend/API/database (`supabase`) owns platform authority, product access rules, permission checks, and persistence.

If the admin app needs to know Edge Function action strings, table names, SQL details, or backend permission quirks, move that knowledge into the SDK or backend.

## Admin Roles & Permissions

The admin role editor is allowed to edit built-in and custom product roles. Admin is the platform authority.

Role editing should stay focused:

- Role rail shows available roles and permission counts.
- Role header shows identity, built-in/custom state, and save action.
- Permission category rail shows grant count by category.
- Permission editor shows only the selected category.
- Permission changes should remain visible as local draft state until saved.

Do not return to a giant permission matrix unless the product explicitly needs comparison across roles. If comparison is needed later, build it as a separate read-only audit view, not as the primary editor.

## Quality Bar

Before accepting admin UI changes, check:

- Can an operator switch products quickly?
- Is the selected product always obvious?
- Is the current task obvious?
- Does the page use desktop width effectively?
- Is the active object obvious?
- Is only the focused category being edited?
- Are actions close to their affected data?
- Are IDs secondary to human labels?
- Does refresh preserve useful context?
- Does the change avoid adding product logic to the website layer?

If the answer is no, keep iterating. Admin is an operations tool; "available somewhere on the page" is not good enough.
