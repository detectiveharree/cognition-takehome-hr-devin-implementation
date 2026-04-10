"use client";

import Image from "next/image";
import { useSidebar } from "@/components/ui/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/40">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        
        {/* Devin logo - animates in when sidebar is collapsed */}
        <div
          className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out ${
            isCollapsed ? "w-auto opacity-100" : "w-0 opacity-0"
          }`}
        >
          <Separator
            orientation="vertical"
            className="mr-1 data-[orientation=vertical]:h-4"
          />
          <Image
            src="/DevinLogoSquare.png"
            alt="Devin"
            width={24}
            height={24}
            className="h-6 w-6 rounded"
            style={{ width: 'auto', height: 'auto' }}
          />
          <span className="font-semibold text-sm whitespace-nowrap">Devin</span>
        </div>
        
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
