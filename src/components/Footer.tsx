import {
  DiscordLogoIcon,
  GitHubLogoIcon,
  TwitterLogoIcon,
} from "@radix-ui/react-icons";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="flex content-end self-end lg:items-center items-start flex-col gap-6 lg:flex-row justify-between w-full py-3 px-5 mt-5">
      <div>
        <p>
          Built by <span className="text-xl font-bold">RootstockLabs</span>
        </p>
        <p className="text-sm opacity-60">
          Copyright &copy; {year} Rootstock Labs. All rights reserved.
        </p>
      </div>
      <ul className="flex gap-6">
        <li>
          <a
            href="https://rootstock.io/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:opacity-80 transition"
          >
            About RootstockLabs
          </a>
        </li>
        <li>
          <a
            href="https://rootstock.io/contact/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:opacity-80 transition"
          >
            Help
          </a>
        </li>
        <li>
          <a
            href="https://dev.rootstock.io/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:opacity-80 transition"
          >
            Documentation
          </a>
        </li>
      </ul>
      <ul className="flex gap-6">
        <li>
          <a
            href="https://twitter.com/rootstock_io"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:opacity-80 transition"
            aria-label="Rootstock on X"
          >
            <TwitterLogoIcon height={25} width={25} />
          </a>
        </li>
        <li>
          <a
            href="https://github.com/rsksmart"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:opacity-80 transition"
            aria-label="Rootstock on GitHub"
          >
            <GitHubLogoIcon height={25} width={25} />
          </a>
        </li>
        <li>
          <a
            href="https://discord.com/invite/rootstock"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:opacity-80 transition -ml-1"
            aria-label="Rootstock on Discord"
          >
            <DiscordLogoIcon height={25} width={25} />
          </a>
        </li>
      </ul>
    </footer>
  );
}