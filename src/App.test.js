import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders loading texts and create button", () => {
  render(<App />);
  expect(screen.getByText(/Loading planner books.../i)).toBeInTheDocument();
  expect(screen.getByText(/Loading Google data.../i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Create/i })).toBeInTheDocument();
});
