import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the sidebar component', () => {
    expect(component).toBeTruthy();
  });

  it('should have navigation items defined with routes', () => {
    expect(component.navItems.length).toBe(4);
    expect(component.navItems[0].route).toBe('/dashboard');
    expect(component.navItems[1].route).toBe('/dashboard/send-otp');
    expect(component.navItems[2].route).toBe('/dashboard/logs');
    expect(component.navItems[3].route).toBe('/dashboard/api-keys');
  });

  it('should emit tabChange when selectTab is called', () => {
    let selectedTab: string | null = null;
    component.tabChange.subscribe((tab) => {
      selectedTab = tab;
    });

    component.selectTab('otp');
    expect(selectedTab).toBe('otp');
  });
});
