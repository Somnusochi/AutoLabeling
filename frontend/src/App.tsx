import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
        </Route>
      </Routes>
    </>
  );
}
