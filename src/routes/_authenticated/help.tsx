import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LifeBuoy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/help")({
  component: HelpPage,
});

const FACULTY_ROLES = new Set(["super_admin", "hr_admin", "trainer", "faculty"]);

function HelpPage() {
  const { data: isAdmin } = useQuery({
    queryKey: ["help-is-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      return (roles ?? []).some((r) => FACULTY_ROLES.has(r.role));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <LifeBuoy className="h-3.5 w-3.5" /> Help
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Getting Started</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A quick guide to using the platform — for everyone, and for admins.
        </p>
      </div>

      <Tabs defaultValue="employee" className="w-full">
        <TabsList>
          <TabsTrigger value="employee">For Everyone</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin">For Admins & Course Creators</TabsTrigger>}
        </TabsList>

        <TabsContent value="employee" className="mt-4">
          <EmployeeGuide />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="mt-4">
            <AdminGuide />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function GuideCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-2 shadow-card sm:p-4">
      <Accordion type="single" collapsible className="w-full">
        {children}
      </Accordion>
    </div>
  );
}

function EmployeeGuide() {
  return (
    <GuideCard>
      <AccordionItem value="signin">
        <AccordionTrigger>Signing in</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Go to the site and choose <strong>Employee Sign In</strong>. Enter your work email —
            you'll get a 6-digit code by email every time you sign in (even if you also use Google).
            Enter the code to continue.
          </p>
          <p>
            First time signing in? After entering the code, you'll be asked to pick your role and
            center — this only happens once.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="catalog">
        <AccordionTrigger>Finding and starting a course</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Open <strong>Course Catalog</strong> from the sidebar (or the "Browse Catalog" button at
            the top). Click any course to see its lessons, then click a lesson to start watching.
          </p>
          <p>Your progress through each course is saved automatically as you complete lessons.</p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="quizzes">
        <AccordionTrigger>Quizzes and certificates</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Some lessons have a quiz attached — you'll see it after finishing the lesson. Passing
            the required quizzes in a course completes it and generates a certificate, visible under{" "}
            <strong>Certificates</strong> in the sidebar.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="assignments">
        <AccordionTrigger>Assignments</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            If a course has an assignment, it appears under <strong>My Assignments</strong>. Submit
            your work there — an instructor will grade it and you'll be notified.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="live">
        <AccordionTrigger>Live classes & discussions</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Live Classes</strong> lists any scheduled sessions for your courses — join from
            there when one starts. <strong>Calendar</strong> shows upcoming sessions and deadlines.
          </p>
          <p>
            Each course also has a discussion thread for questions, reachable from the course page.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="profile">
        <AccordionTrigger>Your profile & notifications</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Update your details under <strong>My Profile</strong>. The bell icon at the top shows
            notifications (announcements, grading results, quiz reminders).
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="signedout">
        <AccordionTrigger>Why did I get signed out?</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            For security, you're signed out automatically after 30 minutes of no activity, and every
            fresh sign-in requires the emailed code again. This is expected — just sign in again.
          </p>
        </AccordionContent>
      </AccordionItem>
    </GuideCard>
  );
}

function AdminGuide() {
  return (
    <GuideCard>
      <AccordionItem value="signin-admin">
        <AccordionTrigger>Signing in as an admin</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Admins sign in with a password at <strong>Admin Login</strong>, not the emailed code. If
            you need a new admin account created, an existing super admin can add you from{" "}
            <strong>Users</strong>.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="orgs">
        <AccordionTrigger>Organizations & centers</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Go to <strong>Organizations</strong> to add, edit, or deactivate centers and
            organizations — no database access needed. New centers show up immediately in the
            employee sign-up flow.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="courses">
        <AccordionTrigger>Creating a course</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Go to <strong>Course Builder</strong> → New Course. Add a title, description, and a
            cover image (drag and drop one onto the placeholder at the top of the course editor).
            Then add modules and lessons using the Structure tab.
          </p>
          <p>
            A course stays a private draft until you click Publish — students only see published
            courses.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="video">
        <AccordionTrigger>Adding a lesson video</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>Open a lesson and use the Video section. Two ways to add a video:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Drag and drop</strong> the video file directly onto the box, or click Upload —
              this uploads it and fills in everything automatically.
            </li>
            <li>
              If the video is already uploaded to Hostinger's File Manager, just type its{" "}
              <strong>filename</strong> (exactly as shown there, e.g.{" "}
              <code className="rounded bg-muted px-1">lesson-3.mp4</code>) into the video field — no
              need to construct or paste a full link.
            </li>
          </ul>
          <p>
            The video's actual length is detected automatically and filled into Duration — you don't
            need to type it. The course's total duration (shown in the catalog) is calculated
            automatically from all its lessons.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="quizzes-admin">
        <AccordionTrigger>Quizzes and assignments</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Attach or create a quiz from within a lesson's edit dialog. Assignments are managed from
            the course's Assignments tab. Submitted assignments appear under{" "}
            <strong>Grading</strong> for review.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="users-admin">
        <AccordionTrigger>Managing employees</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Users</strong> lists every employee — search, filter by role or center, disable
            an account, or change a role. Front-line roles can also self-sign-up; admin roles (super
            admin / HR admin) must be created here directly.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="announcements-admin">
        <AccordionTrigger>Announcements & live classes</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Post org-wide updates from <strong>Announcements</strong> — they show up as a
            notification for everyone. Schedule a live session from <strong>Schedule Class</strong>.
          </p>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="audit">
        <AccordionTrigger>Audit logs</AccordionTrigger>
        <AccordionContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Audit Logs</strong> records sign-ins and admin actions (role changes, account
            creation, etc.) for accountability.
          </p>
        </AccordionContent>
      </AccordionItem>
    </GuideCard>
  );
}
