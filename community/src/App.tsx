import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CreateCommunityPage from './pages/CreateCommunityPage';
import CommunityHomePage from './pages/CommunityHomePage';
import PostWritePage from './pages/PostWritePage';
import PostDetailPage from './pages/PostDetailPage';
import CommunitySettingsPage from './pages/CommunitySettingsPage';
import MyPage from './pages/MyPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="create" element={<CreateCommunityPage />} />
        <Route path="me" element={<MyPage />} />
        <Route path="c/:slug" element={<CommunityHomePage />} />
        <Route path="c/:slug/write" element={<PostWritePage />} />
        <Route path="c/:slug/post/:postId" element={<PostDetailPage />} />
        <Route path="c/:slug/settings" element={<CommunitySettingsPage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
