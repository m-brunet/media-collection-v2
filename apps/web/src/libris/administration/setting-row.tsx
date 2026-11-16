import type { ReactNode } from 'react';

export class SettingIds {
    static title(id: string): string {
        return id + '-title';
    }

    static detail(id: string): string {
        return id + '-detail';
    }
}

export function SettingRow({
    id,
    title,
    detail,
    control,
    children,
}: {
    id: string;
    title: string;
    detail?: ReactNode;
    control?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className="setting-row">
            <div className="setting-row__line">
                <div className="setting-row__text">
                    <h3 id={SettingIds.title(id)} className="setting-row__title">
                        {title}
                    </h3>
                    {detail && (
                        <p id={SettingIds.detail(id)} className="setting-row__detail">
                            {detail}
                        </p>
                    )}
                </div>
                {control && <div className="setting-row__control">{control}</div>}
            </div>
            <div className="setting-row__messages">{children}</div>
        </div>
    );
}
