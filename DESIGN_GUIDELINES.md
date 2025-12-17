# AvatarPitch Design Guidelines

## Overview
This document defines the design system for AvatarPitch, ensuring consistency across all pages and components. The design follows a modern, professional aesthetic inspired by premium SaaS applications like Miro, with a clean, light-themed interface.

## Design Philosophy
- **Professional & Modern**: The application should feel like a billion-dollar startup product, not a POC or MVP
- **Consistency**: All components follow the same design principles
- **Usability**: Every interaction should feel polished and intentional
- **Visual Hierarchy**: Clear information architecture with proper spacing and typography

---

## Color Palette

### Primary Colors
- **Primary Green**: `#10B981` (emerald-500)
  - Used for: Primary buttons, active states, links, success indicators
  - Hover: `#059669` (emerald-600)
  - Active: `#047857` (emerald-700)

### Secondary Colors
- **Accent Yellow**: `#FBBF24` (amber-400)
  - Used for: Highlights, badges, warnings, important callouts
  - Hover: `#F59E0B` (amber-500)

### Neutral Colors
- **Background Primary**: `#FFFFFF` (white)
- **Background Secondary**: `#F9FAFB` (gray-50)
- **Background Tertiary**: `#F3F4F6` (gray-100)

- **Text Primary**: `#111827` (gray-900)
- **Text Secondary**: `#4B5563` (gray-600)
- **Text Tertiary**: `#9CA3AF` (gray-400)

- **Border Light**: `#E5E7EB` (gray-200)
- **Border Medium**: `#D1D5DB` (gray-300)

### Semantic Colors
- **Error**: `#EF4444` (red-500)
- **Warning**: `#F59E0B` (amber-500)
- **Success**: `#10B981` (emerald-500)
- **Info**: `#3B82F6` (blue-500)

---

## Typography

### Font Family
- **Primary Font**: `Inter` (system font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`)
- **Monospace**: `'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', monospace`

### Font Sizes
- **Display Large**: `3rem` (48px) - Hero sections, major headings
- **Display Medium**: `2.25rem` (36px) - Page titles
- **Display Small**: `1.875rem` (30px) - Section headings
- **Heading Large**: `1.5rem` (24px) - Card titles, subsection headings
- **Heading Medium**: `1.25rem` (20px) - Component titles
- **Heading Small**: `1.125rem` (18px) - Subheadings
- **Body Large**: `1rem` (16px) - Primary body text
- **Body Medium**: `0.875rem` (14px) - Secondary text, descriptions
- **Body Small**: `0.75rem` (12px) - Captions, metadata, labels

### Font Weights
- **Light**: 300
- **Regular**: 400 (default body text)
- **Medium**: 500 (emphasis, buttons)
- **Semibold**: 600 (headings, important text)
- **Bold**: 700 (major headings, strong emphasis)

### Line Heights
- **Tight**: 1.2 (headings)
- **Normal**: 1.5 (body text)
- **Relaxed**: 1.75 (long-form content)

---

## Spacing System

### Base Unit
- **Base**: `4px` (0.25rem)

### Spacing Scale
- **xs**: `0.25rem` (4px)
- **sm**: `0.5rem` (8px)
- **md**: `1rem` (16px)
- **lg**: `1.5rem` (24px)
- **xl**: `2rem` (32px)
- **2xl**: `3rem` (48px)
- **3xl**: `4rem` (64px)

### Component Spacing
- **Card Padding**: `1.5rem` (24px) on desktop, `1rem` (16px) on mobile
- **Section Gap**: `2rem` (32px) on desktop, `1.5rem` (24px) on mobile
- **Element Gap**: `1rem` (16px) standard, `0.75rem` (12px) for tight layouts

---

## Border Radius

### Standard Radius
- **Small**: `0.5rem` (8px) - Small badges, tags
- **Medium**: `0.75rem` (12px) - Buttons, inputs, small cards
- **Large**: `1rem` (16px) - Cards, containers (default)
- **XLarge**: `1.5rem` (24px) - Large cards, modals
- **Full**: `9999px` - Pills, avatars

### Usage Guidelines
- **Cards**: `1rem` (16px) - rounded-xl
- **Buttons**: `0.75rem` (12px) - rounded-xl
- **Inputs**: `0.75rem` (12px) - rounded-xl
- **Badges**: `0.5rem` (8px) - rounded-lg

---

## Shadows

### Shadow Levels
- **sm**: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` - Subtle elevation
- **md**: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)` - Cards, dropdowns
- **lg**: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)` - Modals, popovers
- **xl**: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)` - Large modals

### Usage
- **Cards**: `shadow-sm` or `shadow-md`
- **Buttons**: `shadow-sm` (hover: `shadow-md`)
- **Modals**: `shadow-xl`
- **Elevated Elements**: `shadow-lg`

---

## Icons

### Icon Library
- **Primary**: Lucide React (line-style icons)
- **Size Standard**: `20px` (1.25rem) for standard icons
- **Size Small**: `16px` (1rem) for inline icons
- **Size Large**: `24px` (1.5rem) for prominent icons
- **Size XLarge**: `32px` (2rem) for hero icons

### Icon Style
- **Stroke Width**: `2px` (default)
- **Color**: Inherit from parent or use semantic colors
- **Alignment**: Center-aligned with text

### Icon Usage
- Navigation icons: `20px`
- Button icons: `16px` or `20px`
- Card icons: `24px` or `32px`
- Status indicators: `16px` with colored circles

---

## Buttons

### Primary Button
```tsx
className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium 
          shadow-sm hover:bg-emerald-600 hover:shadow-md 
          active:bg-emerald-700 active:scale-95 
          transition-all duration-200"
```

### Secondary Button
```tsx
className="px-6 py-3 bg-white text-gray-700 border border-gray-200 
          rounded-xl font-medium shadow-sm hover:bg-gray-50 
          hover:shadow-md active:bg-gray-100 active:scale-95 
          transition-all duration-200"
```

### Ghost Button
```tsx
className="px-6 py-3 text-gray-700 rounded-xl font-medium 
          hover:bg-gray-100 active:bg-gray-200 
          transition-all duration-200"
```

### Button Sizes
- **Small**: `px-4 py-2 text-sm`
- **Medium**: `px-6 py-3 text-base` (default)
- **Large**: `px-8 py-4 text-lg`

---

## Cards

### Standard Card
```tsx
className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
```

### Elevated Card
```tsx
className="bg-white rounded-xl p-6 shadow-md border border-gray-200"
```

### Interactive Card
```tsx
className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 
          hover:shadow-md transition-all duration-200 cursor-pointer"
```

### Card Spacing
- **Padding**: `1.5rem` (24px) standard, `1rem` (16px) on mobile
- **Gap between cards**: `1.5rem` (24px) on desktop, `1rem` (16px) on mobile

---

## Forms

### Input Fields
```tsx
className="w-full px-4 py-3 border border-gray-200 rounded-xl 
          focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
          transition-all duration-200 text-base"
```

### Labels
```tsx
className="block text-sm font-medium text-gray-700 mb-2"
```

### Error States
```tsx
className="border-red-300 focus:border-red-500 focus:ring-red-500/20"
```

### Select Dropdowns
- Same styling as input fields
- Custom arrow icon (Lucide ChevronDown)

---

## Sidebar Navigation

### Sidebar Structure
- **Width**: `256px` (16rem) on desktop
- **Background**: `#FFFFFF` (white)
- **Border**: Right border `1px solid #E5E7EB` (gray-200)

### Navigation Items
```tsx
className="flex items-center gap-3 px-4 py-3 rounded-xl 
          transition-all duration-200
          active:bg-emerald-50 text-emerald-700 font-medium
          inactive:text-gray-700 hover:bg-gray-50"
```

### Icon Size in Navigation
- `20px` (1.25rem) with `4px` gap to text

### Logo/Brand Area
- Padding: `1.5rem` (24px)
- Border bottom: `1px solid #E5E7EB`
- Font size: `1.25rem` (20px), font weight: `700`

---

## Layout

### Container
- **Max Width**: `1280px` (80rem)
- **Padding**: `2rem` (32px) on desktop, `1rem` (16px) on mobile
- **Background**: `#F9FAFB` (gray-50)

### Grid System
- Use CSS Grid or Flexbox
- **Gap**: `1.5rem` (24px) standard
- **Responsive**: 1 column mobile, 2-3 columns tablet, 3-4 columns desktop

---

## Responsive Design

### Breakpoints
- **Mobile**: `< 640px` (sm)
- **Tablet**: `640px - 1024px` (md, lg)
- **Desktop**: `> 1024px` (xl, 2xl)

### Mobile Considerations
- Reduced padding: `1rem` instead of `1.5rem`
- Stack layouts vertically
- Touch targets: Minimum `44px` height
- Larger tap areas for interactive elements

---

## Animations & Transitions

### Standard Transitions
- **Duration**: `200ms` (duration-200)
- **Easing**: `ease-in-out`
- **Properties**: `all` or specific (color, transform, shadow)

### Hover Effects
- **Scale**: `active:scale-95` for buttons
- **Shadow**: Increase shadow on hover
- **Color**: Slight darkening on hover

### Loading States
- Use skeleton loaders matching content structure
- Spinner: `animate-spin` with `2s` duration
- Progress bars: Smooth transitions

---

## Accessibility

### Color Contrast
- Text on background: Minimum 4.5:1 ratio
- Large text: Minimum 3:1 ratio
- Interactive elements: Clear focus states

### Focus States
```tsx
className="focus:outline-none focus:ring-2 focus:ring-emerald-500 
          focus:ring-offset-2"
```

### Touch Targets
- Minimum `44px × 44px` for all interactive elements
- Adequate spacing between touch targets

---

## Component-Specific Guidelines

### Tables
- Header: `bg-gray-50` with `border-b border-gray-200`
- Rows: `hover:bg-gray-50` transition
- Borders: `border-gray-200`
- Padding: `1rem` (16px) horizontal, `0.75rem` (12px) vertical

### Badges/Tags
- Background: `bg-emerald-50` or `bg-amber-50`
- Text: `text-emerald-700` or `text-amber-700`
- Border radius: `0.5rem` (8px)
- Padding: `0.25rem 0.75rem`

### Modals/Dialogs
- Background overlay: `bg-black/50` backdrop blur
- Modal: `bg-white rounded-xl shadow-xl`
- Padding: `1.5rem` (24px)
- Max width: `32rem` (512px) for standard modals

### Empty States
- Icon: `48px` or `64px`
- Text: Center-aligned, `text-gray-500`
- CTA button: Primary button style

---

## Implementation Notes

### Tailwind Classes
All design tokens are available as Tailwind utility classes:
- Colors: `bg-emerald-500`, `text-gray-900`, etc.
- Spacing: `p-6`, `gap-4`, `mb-8`, etc.
- Typography: `text-lg`, `font-semibold`, etc.
- Borders: `rounded-xl`, `border-gray-200`, etc.
- Shadows: `shadow-sm`, `shadow-md`, etc.

### Custom Utilities
- `.touch-manipulation` - Improves touch responsiveness
- Custom focus states for accessibility

### Consistency Checklist
When creating new components, ensure:
- [ ] Uses design system colors
- [ ] Follows spacing scale
- [ ] Uses correct border radius
- [ ] Has proper shadows
- [ ] Includes hover/active states
- [ ] Meets accessibility standards
- [ ] Responsive on all breakpoints
- [ ] Uses Lucide icons consistently

---

## Examples

### Card Component
```tsx
<div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
  <h3 className="text-lg font-semibold text-gray-900 mb-2">Card Title</h3>
  <p className="text-sm text-gray-600">Card content goes here.</p>
</div>
```

### Button Component
```tsx
<button className="px-6 py-3 bg-emerald-500 text-white rounded-xl 
                  font-medium shadow-sm hover:bg-emerald-600 
                  hover:shadow-md active:scale-95 transition-all">
  Click Me
</button>
```

### Input Component
```tsx
<input className="w-full px-4 py-3 border border-gray-200 rounded-xl 
                  focus:border-emerald-500 focus:ring-2 
                  focus:ring-emerald-500/20 transition-all" />
```

---

## Version History
- **v1.0** (2025-01-XX): Initial design system based on Mindscope Learning and Miro UI patterns

