import {Routes, Route} from "react-router-dom";
import {Toaster} from "react-hot-toast";

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
