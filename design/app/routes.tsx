import { createBrowserRouter } from "react-router";
import { MarketingLanding } from "./pages/marketing-landing";
import { AppLayout } from "./components/app-layout";
import { Dashboard } from "./pages/dashboard";
import { Transactions } from "./pages/transactions";
import { AIChat } from "./pages/ai-chat";
import { VoiceInput } from "./pages/voice-input";
import { Goals } from "./pages/goals";
import { BudgetPlanner } from "./pages/budget-planner";
import { Summary } from "./pages/summary";
import { NotFound } from "./pages/not-found";

// Marketing pages
import { Pricing } from "./pages/marketing/pricing";
import { Features } from "./pages/marketing/features";
import { FeatureSmartBudgeting } from "./pages/marketing/feature-smart-budgeting";
import { FeatureAIInsights } from "./pages/marketing/feature-ai-insights";
import { FeatureVoiceCommands } from "./pages/marketing/feature-voice-commands";
import { FeatureGoalTracking } from "./pages/marketing/feature-goal-tracking";
import { Security } from "./pages/marketing/security";
import { Roadmap } from "./pages/marketing/roadmap";

// Auth pages
import { SignIn } from "./pages/auth/signin";
import { SignUp } from "./pages/auth/signup";
import { ForgotPassword } from "./pages/auth/forgot-password";

// Company pages
import { About } from "./pages/company/about";
import { Blog } from "./pages/company/blog";
import { BlogPost } from "./pages/company/blog-post";
import { Careers } from "./pages/company/careers";
import { CareerDetail } from "./pages/company/career-detail";
import { Press } from "./pages/company/press";

// Legal pages
import { Privacy } from "./pages/legal/privacy";
import { Terms } from "./pages/legal/terms";
import { Compliance } from "./pages/legal/compliance";

// Settings pages
import { Profile } from "./pages/settings/profile";
import { Account } from "./pages/settings/account";
import { Preferences } from "./pages/settings/preferences";
import { Notifications } from "./pages/settings/notifications";
import { Security as SecuritySettings } from "./pages/settings/security";

// Support
import { Support } from "./pages/support";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MarketingLanding />,
  },
  // Marketing pages
  {
    path: "/pricing",
    element: <Pricing />,
  },
  {
    path: "/features",
    element: <Features />,
  },
  {
    path: "/features/smart-budgeting",
    element: <FeatureSmartBudgeting />,
  },
  {
    path: "/features/ai-insights",
    element: <FeatureAIInsights />,
  },
  {
    path: "/features/voice-commands",
    element: <FeatureVoiceCommands />,
  },
  {
    path: "/features/goal-tracking",
    element: <FeatureGoalTracking />,
  },
  {
    path: "/security",
    element: <Security />,
  },
  {
    path: "/roadmap",
    element: <Roadmap />,
  },
  // Auth pages
  {
    path: "/signin",
    element: <SignIn />,
  },
  {
    path: "/signup",
    element: <SignUp />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  // Company pages
  {
    path: "/about",
    element: <About />,
  },
  {
    path: "/blog",
    element: <Blog />,
  },
  {
    path: "/blog/:slug",
    element: <BlogPost />,
  },
  {
    path: "/careers",
    element: <Careers />,
  },
  {
    path: "/careers/:slug",
    element: <CareerDetail />,
  },
  {
    path: "/press",
    element: <Press />,
  },
  // Legal pages
  {
    path: "/privacy",
    element: <Privacy />,
  },
  {
    path: "/terms",
    element: <Terms />,
  },
  {
    path: "/compliance",
    element: <Compliance />,
  },
  // App pages
  {
    path: "/app",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "transactions", element: <Transactions /> },
      { path: "chat", element: <AIChat /> },
      { path: "voice", element: <VoiceInput /> },
      { path: "goals", element: <Goals /> },
      { path: "budget", element: <BudgetPlanner /> },
      { path: "summary", element: <Summary /> },
      { path: "settings/profile", element: <Profile /> },
      { path: "settings/account", element: <Account /> },
      { path: "settings/preferences", element: <Preferences /> },
      { path: "settings/notifications", element: <Notifications /> },
      { path: "settings/security", element: <SecuritySettings /> },
      { path: "support", element: <Support /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
]);