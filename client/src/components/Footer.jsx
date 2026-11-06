const Footer = () => {
  return (
    <footer className="w-full z-50 mt-3 flex flex-col items-center justify-center bg-gray-200 text-gray-700 text-center py-4">
      <p>Made with ❤️ by <a href="https://bishal-singh.vercel.app" target="_blank"><span className="text-blue-500 hover:text-red-600"> @Bishal Singh</span></a> </p>
      <p>&copy; {new Date().getFullYear()}Pizzeria. All rights reserved.</p>
    </footer>
  );
};

export default Footer;
