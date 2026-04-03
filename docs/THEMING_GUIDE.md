# 🎨 Theming & Styling Guide

## Overview

This project uses a modern theming system built on:
- **shadcn/ui** - Pre-built component library (MANDATORY for all UI)
- **Tailwind CSS 4** - Utility-first CSS framework
- **OKLCH color space** - Modern color system
- **CSS Custom Properties** - Dynamic theming

### 🌑 Dark Theme Only

This project uses a **dark theme exclusively**. There is no light mode or theme switching. This decision was made because:
- The site is a memorial with a somber, respectful aesthetic
- Dark backgrounds better showcase the photo grid
- Aligns with the project's visual identity
- Provides a consistent experience for all users regardless of system preferences

The theme configuration in `src/app/layout.tsx`:
```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  enableSystem={false}  // System preferences are ignored
  disableTransitionOnChange
>
```

## 🚨 Critical Rules

### 1. ALWAYS Use shadcn/ui Components

**NEVER build custom UI components from scratch.**

```tsx
// ❌ WRONG - Custom button
<button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg">
  Click me
</button>

// ✅ CORRECT - shadcn Button
import { Button } from '@/components/ui/button';
<Button>Click me</Button>
```

### 2. ALWAYS Use Semantic Color Tokens

**NEVER use raw Tailwind colors like `bg-gray-50`, `text-blue-600`, or hardcoded `bg-black`/`text-white`.**

```tsx
// ❌ WRONG - Raw colors
<div className="bg-white text-gray-900 border-gray-200">
  <h1 className="text-blue-600">Title</h1>
  <p className="text-gray-600">Description</p>
</div>

// ❌ WRONG - Hardcoded dark colors
<div className="bg-black text-white">
  <h1>Title</h1>
</div>

// ✅ CORRECT - Semantic tokens
<div className="bg-card text-card-foreground border">
  <h1 className="text-primary">Title</h1>
  <p className="text-muted-foreground">Description</p>
</div>
```

### 3. NO `dark:` Prefixes Needed

Since we use a single fixed dark theme, **NEVER use `dark:` prefixes** in your code (except in shadcn/ui components).

```tsx
// ❌ WRONG - Dark mode prefix
<div className="bg-white dark:bg-gray-900">
  Content
</div>

// ✅ CORRECT - Semantic token (automatically dark)
<div className="bg-card">
  Content
</div>
```

## 📚 Available shadcn/ui Components

The project has **23 shadcn components** installed in `src/components/ui/`:

### Layout & Structure
- `<Card>` - Container with header, content, footer
- `<Separator>` - Divider line
- `<Sidebar>` - Collapsible sidebar navigation

### Forms & Inputs
- `<Form>` - Form wrapper with validation
- `<Input>` - Text input field
- `<Textarea>` - Multi-line text input
- `<Select>` - Dropdown selector
- `<Label>` - Form field label
- `<Slider>` - Range input

### Buttons & Actions
- `<Button>` - Primary action button
- `<DropdownMenu>` - Dropdown menu
- `<Sheet>` - Slide-out panel
- `<Tabs>` - Tab navigation

### Feedback & Overlays
- `<Alert>` - Warning/info messages
- `<AlertDialog>` - Confirmation dialog
- `<Dialog>` - Modal dialog
- `<Sonner>` - Toast notifications (via `toast()`)
- `<Tooltip>` - Hover tooltips

### Data Display
- `<Table>` - Data table
- `<Badge>` - Status badge
- `<Accordion>` - Collapsible sections
- `<Skeleton>` - Loading placeholder
- `<Spinner>` - Loading spinner

## 🎨 Color System

### Semantic Color Tokens

The theme uses semantic tokens defined in `src/app/globals.css`:

#### Text Colors
```tsx
text-foreground          // Primary text (almost white)
text-muted-foreground    // Secondary text (gray)
text-primary             // Brand/accent text
text-destructive         // Error/danger text
text-card-foreground     // Text on cards
text-popover-foreground  // Text in popovers
```

#### Background Colors
```tsx
bg-background      // Page background (almost black)
bg-card            // Card background (dark gray)
bg-popover         // Popover background
bg-primary         // Primary brand color
bg-secondary       // Secondary brand color
bg-muted           // Muted/disabled background
bg-accent          // Accent highlights
bg-destructive     // Error background
```

#### Borders & Inputs
```tsx
border             // Default border color
border-input       // Input border
ring               // Focus ring color
```

#### Sidebar Colors
```tsx
bg-sidebar                    // Sidebar background
text-sidebar-foreground       // Sidebar text
bg-sidebar-primary            // Sidebar primary items
bg-sidebar-accent             // Sidebar accent items
border-sidebar                // Sidebar borders
```

### Chart Colors (for data visualization)
```tsx
bg-chart-1    // Chart color 1
bg-chart-2    // Chart color 2
bg-chart-3    // Chart color 3
bg-chart-4    // Chart color 4
bg-chart-5    // Chart color 5
```

## 🎨 Customizing Colors

### Where Colors Are Defined

All theme colors are in `src/app/globals.css`:

```css
:root {
  --background: oklch(0.145 0 0);       /* Almost black */
  --foreground: oklch(0.985 0 0);       /* Almost white */
  --card: oklch(0.205 0 0);             /* Dark gray */
  --primary: oklch(0.922 0 0);          /* Light gray */
  --destructive: oklch(0.5819 0.1748 27.94);  /* Red */
  /* ... more colors */
}
```

### Changing Theme Colors

To change the brand color (primary):

1. Open `src/app/globals.css`
2. Find the `:root` section
3. Modify the `--primary` value:

```css
:root {
  /* Current: Light gray */
  --primary: oklch(0.922 0 0);
  
  /* Example: Blue */
  --primary: oklch(0.7 0.15 250);
  
  /* Example: Red */
  --primary: oklch(0.6 0.22 25);
  
  /* Example: Green */
  --primary: oklch(0.65 0.15 145);
}
```

### Using OKLCH Color Space

OKLCH is a modern color space that's more perceptually uniform than RGB/HSL.

**Format**: `oklch(Lightness Chroma Hue)`
- **Lightness**: 0 (black) to 1 (white)
- **Chroma**: 0 (gray) to 0.37+ (vibrant)
- **Hue**: 0-360 degrees (red=0, green=120, blue=240)

**Examples**:
```css
oklch(0.5 0 0)        /* Medium gray (no chroma) */
oklch(0.6 0.15 250)   /* Medium blue */
oklch(0.8 0.1 145)    /* Light green */
oklch(0.4 0.2 0)      /* Dark red */
```

**Color Picker**: Use [oklch.com](https://oklch.com) to visually pick colors.

## 📏 Spacing & Layout

### Border Radius

The project has a consistent border radius system:

```tsx
rounded-sm    // Slightly rounded (--radius - 4px)
rounded-md    // Medium rounded (--radius - 2px)
rounded-lg    // Large rounded (--radius)
rounded-xl    // Extra large rounded (--radius + 4px)
```

Default radius is `0.625rem` (10px). To change it:

```css
/* src/app/globals.css */
:root {
  --radius: 0.5rem;  /* More square corners */
  --radius: 1rem;    /* More rounded corners */
}
```

### Common Layout Patterns

```tsx
// Page container
<div className="container mx-auto p-6">
  {/* Content */}
</div>

// Card grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>

// Two-column layout
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div>Left</div>
  <div>Right</div>
</div>

// Stack with spacing
<div className="space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

## 🔧 Adding New Components

### Workflow

1. **Search shadcn registry** for the component:
   ```bash
   npx shadcn@latest search button
   npx shadcn@latest search table
   npx shadcn@latest search form
   ```

2. **Install the component**:
   ```bash
   npx shadcn@latest add button
   npx shadcn@latest add table
   npx shadcn@latest add form
   ```

3. **Import and use**:
   ```tsx
   import { Button } from '@/components/ui/button';
   
   export function MyComponent() {
     return <Button>Click me</Button>;
   }
   ```

### Component Variants

Most shadcn components have built-in variants:

```tsx
// Button variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Button sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon only</Button>

// Badge variants
<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

## 📝 Best Practices

### 1. Component Composition

Build complex UIs by combining shadcn components:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function PersonCard({ person }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{person.name}</CardTitle>
          <Badge>{person.status}</Badge>
        </div>
        <CardDescription>{person.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button>View Details</Button>
      </CardContent>
    </Card>
  );
}
```

### 2. Responsive Design

Use Tailwind's responsive prefixes:

```tsx
<div className="
  grid 
  grid-cols-1        // 1 column on mobile
  md:grid-cols-2     // 2 columns on tablet
  lg:grid-cols-3     // 3 columns on desktop
  gap-4
">
  {/* Items */}
</div>
```

### 3. Conditional Styles

Use `cn()` helper for conditional classes:

```tsx
import { cn } from '@/lib/utils';

<Button 
  className={cn(
    "w-full",
    isLoading && "opacity-50 cursor-not-allowed"
  )}
>
  Submit
</Button>
```

### 4. Always Use Semantic Tokens

Since the project uses a fixed dark theme, always use semantic tokens:

```tsx
// ✅ CORRECT - Semantic tokens
<div className="bg-card text-card-foreground">
  Content
</div>

// ❌ AVOID - Hardcoded colors
<div className="bg-gray-900 text-white">
  Content
</div>

// ❌ AVOID - Dark mode prefixes (not needed)
<div className="dark:bg-gray-900">
  Content
</div>
```

## 🎯 Common Styling Patterns

### Forms

```tsx
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

<Form {...form}>
  <FormField
    control={form.control}
    name="name"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          <Input placeholder="Enter name" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
  <Button type="submit">Submit</Button>
</Form>
```

### Data Tables

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell><Badge>{item.status}</Badge></TableCell>
        <TableCell>
          <Button size="sm" variant="outline">Edit</Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Loading States

```tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

// Skeleton for layout
<div className="space-y-4">
  <Skeleton className="h-12 w-full" />
  <Skeleton className="h-64 w-full" />
</div>

// Spinner for actions
<Button disabled>
  <Spinner className="mr-2" />
  Loading...
</Button>
```

### Alerts & Notifications

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

// Alert component
<Alert>
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>
    This action cannot be undone.
  </AlertDescription>
</Alert>

// Toast notification
toast.success('Changes saved successfully');
toast.error('Failed to save changes');
toast.info('This is an informational message');
```

## 🚀 Quick Reference

### Color Token Cheat Sheet

| Use Case | Token | Example |
|----------|-------|---------|
| Page background | `bg-background` | Main page |
| Primary text | `text-foreground` | Body text |
| Secondary text | `text-muted-foreground` | Captions, labels |
| Card container | `bg-card` | Content cards |
| Brand/accent | `bg-primary` `text-primary` | CTAs, links |
| Borders | `border` | Dividers, outlines |
| Error/danger | `bg-destructive` `text-destructive` | Error messages |
| Success | `bg-green-500` (custom) | Success messages |

### Common Utility Classes

```tsx
// Spacing
p-4 px-6 py-2 m-4 mx-auto space-y-4 gap-4

// Layout
flex flex-col items-center justify-between
grid grid-cols-3 gap-4

// Typography
text-sm text-base text-lg text-xl font-bold

// Borders & Shadows
rounded-lg border shadow-md

// Responsive
hidden md:block lg:grid-cols-3

// State
hover:bg-accent active:scale-95 disabled:opacity-50
```

## 📚 Resources

- **shadcn/ui Docs**: https://ui.shadcn.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **OKLCH Color Picker**: https://oklch.com
- **Project Components**: `src/components/ui/`

## ✅ Contribution Checklist

Before submitting style changes:

- [ ] Used shadcn components (not custom UI)
- [ ] Used semantic color tokens (not raw colors like `bg-gray-50` or `text-white`)
- [ ] Tested on mobile/tablet/desktop (responsive design)
- [ ] Followed existing component patterns
- [ ] No inline styles or hardcoded colors
- [ ] No `dark:` prefixes (not needed - single theme only)
- [ ] Updated documentation if adding new patterns

---

**Remember**: If shadcn has it, use it. Always use semantic tokens. Never build custom UI from scratch.
