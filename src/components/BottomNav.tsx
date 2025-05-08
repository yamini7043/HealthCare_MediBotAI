
'use client';

import React from 'react';
import { HomeIcon, BookmarkIcon, PillIcon, UserIcon, ScanLineIcon } from 'lucide-react'; // Added ScanLineIcon
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Dispatch, SetStateAction } from 'react'; // Import types

// Define the possible view names matching page.tsx state
type ActiveView = 'home' | 'saved' | 'meds' | 'profile' | 'scan'; // Added 'scan' view

interface NavItem {
  name: string;
  view: ActiveView; // Use the ActiveView type
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Home', view: 'home', icon: HomeIcon },
  { name: 'Scan', view: 'scan', icon: ScanLineIcon }, // Added scan item
  { name: 'Saved', view: 'saved', icon: BookmarkIcon },
  { name: 'Meds', view: 'meds', icon: PillIcon },
  { name: 'Profile', view: 'profile', icon: UserIcon },
];

interface BottomNavProps {
  activeView: ActiveView;
  setActiveView: Dispatch<SetStateAction<ActiveView>>; // Function to update the view state
}

export default function BottomNav({ activeView, setActiveView }: BottomNavProps) {

  const handleNavClick = (view: ActiveView) => {
     setActiveView(view); // Update the parent component's state
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-md md:hidden">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <Button
            key={item.name}
            variant="ghost"
            className={cn(
              'flex flex-col items-center justify-center h-full w-full rounded-none p-1 text-xs',
              activeView === item.view ? 'text-primary' : 'text-muted-foreground' // Highlight based on activeView prop
            )}
            onClick={() => handleNavClick(item.view)} // Call setActiveView with the view name
            aria-label={item.name}
            aria-current={activeView === item.view ? 'page' : undefined} // Set aria-current for active item
          >
            <item.icon className="h-5 w-5 mb-1" />
            {item.name}
          </Button>
        ))}
      </div>
    </nav>
  );
}
