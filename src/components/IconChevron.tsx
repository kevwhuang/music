export function IconChevron({ open }: { open: boolean }) {
    return (
        <svg className="text-white-40 duration-150 transition-transform" aria-hidden="true" height="6" style={{ transform: open ? 'rotate(180deg)' : 'none' }} viewBox="0 0 10 6" width="10">
            <path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}
