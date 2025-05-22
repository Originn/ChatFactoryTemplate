import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

import clsx from 'clsx';

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={clsx(
      'w-full border-0 outline-none focus:outline-none', // Removed border and added outline:none
      className,
    )}
    style={{ outline: 'none', boxShadow: 'none' }}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex w-full outline-none focus:outline-none" style={{ outline: 'none', boxShadow: 'none' }}>
    <AccordionPrimitive.Trigger
      ref={ref}
      className={clsx(
        'flex flex-1 items-center py-4 pl-0 pr-0 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180 text-left outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 active:outline-none',
        className,
      )}
      style={{ outline: 'none', boxShadow: 'none' }}
      {...props}
    >
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>{children}</div>
        <ChevronDown className="h-4 w-4 transition-transform duration-200" />
      </div>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={clsx(
      'data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden text-sm transition-all w-full outline-none focus:outline-none',
      className,
    )}
    style={{ outline: 'none', boxShadow: 'none' }}
    {...props}
  >
    <div className="pt-0 pb-4">{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
