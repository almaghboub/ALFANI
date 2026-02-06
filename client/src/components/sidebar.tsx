import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, TrendingUp, DollarSign, Users2, Settings, LogOut, Menu, Wallet, Boxes, Warehouse, Receipt, History, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/components/auth-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import logoPath from "@assets/alfani-logo.png";

const navigationItems = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["owner", "customer_service", "receptionist", "sorter", "stock_manager"] },
  { key: "newInvoice", href: "/invoice", icon: Receipt, roles: ["owner", "customer_service", "receptionist", "stock_manager"] },
  { key: "salesHistory", href: "/sales", icon: History, roles: ["owner", "customer_service", "receptionist", "stock_manager"] },
  { key: "products", href: "/products", icon: Boxes, roles: ["owner", "customer_service", "receptionist", "stock_manager"] },
  { key: "inventory", href: "/inventory", icon: Warehouse, roles: ["owner", "customer_service", "receptionist", "stock_manager"] },
  { key: "finance", href: "/finance", icon: Wallet, roles: ["owner"] },
  { key: "profitReports", href: "/profits", icon: TrendingUp, roles: ["owner"] },
  { key: "expenses", href: "/expenses", icon: DollarSign, roles: ["owner"] },
  { key: "userManagement", href: "/users", icon: Users2, roles: ["owner"] },
  { key: "settings", href: "/settings", icon: Settings, roles: ["owner", "customer_service", "receptionist", "sorter", "stock_manager"] },
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

function SidebarContent({ onNavigate }: SidebarContentProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const handleLogout = async () => {
    try {
      await logout();
      onNavigate?.();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const filteredNavigation = navigationItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(222,47%,11%)] text-white">
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center justify-center">
          <img src={logoPath} alt="ALFANI Logo" className="h-20 w-auto brightness-110 drop-shadow-lg" />
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Auto Parts & Accessories</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin">
        <div className="space-y-1">
          {filteredNavigation.map((item, index) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <li key={item.key} className="list-none">
                <Link href={item.href} onClick={handleNavClick}>
                  <span
                    className={`group relative flex items-center gap-3 rtl:flex-row-reverse px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-400 shadow-sm shadow-amber-500/10 font-semibold"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                    data-testid={`nav-${item.key.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`}
                  >
                    {isActive && (
                      <div className="absolute ltr:left-0 rtl:right-0 w-[3px] h-6 bg-amber-400 rounded-full" />
                    )}
                    <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? 'text-amber-400' : 'text-white/40 group-hover:text-white/70'}`} />
                    <span className="flex-1 truncate">{t(item.key)}</span>
                    {isActive && (
                      <ChevronRight className="w-4 h-4 text-amber-400/60 rtl:rotate-180" />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </div>
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 rtl:flex-row-reverse px-3 py-2">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center shadow-md shadow-amber-500/20">
            <span className="text-xs font-bold text-slate-900">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-[11px] text-white/40 truncate capitalize">
              {user?.role?.replace("_", " ")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white/40 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  if (!isMobile) {
    return (
      <aside className="w-[260px] min-h-screen flex-shrink-0 shadow-xl">
        <div className="fixed w-[260px] h-screen overflow-hidden">
          <SidebarContent />
        </div>
      </aside>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="fixed top-4 start-4 z-50 bg-card/90 backdrop-blur-sm border-border/50 shadow-lg md:hidden h-10 w-10 p-0"
          data-testid="button-hamburger-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0 border-none">
        <SidebarContent onNavigate={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
