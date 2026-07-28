import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  return (
    <header className="h-14 border-b bg-white flex items-center px-4 gap-4 flex-shrink-0">
      <Button 
        variant="ghost" 
        size="icon" 
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
      {title && (
        <h1 className="text-lg font-semibold text-foreground tracking-tight">{title}</h1>
      )}
    </header>
  );
}
