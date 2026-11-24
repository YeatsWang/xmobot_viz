"""Generate the X lap in metres and radians for the standard 4WISD chassis."""
import bisect
import json
import math
from pathlib import Path

FPS = 24
STEP = 1 / (FPS * 10)
END = 85
ARRIVE = 78
CORNERS = ((.25,.2),(.25,-.2),(-.25,.2),(-.25,-.2))
# Each arm has an outgoing straight, a clockwise cap, a return straight,
# and a counterclockwise inside corner. Timings include both Ackermann lessons.
TIMES = [0,5,11,15.6,19.5,22,30.2,34.1,42.3,46.6,51.4,57.7,60.9,64.7,69.6,74.5,78]


def mix(a,b,u):
    return a+(b-a)*u


def ease(u):
    u=max(0,min(1,u))
    return u*u*(3-2*u)


def bezier(points,u):
    while len(points)>1:
        points=[(mix(x,a,u),mix(y,b,u)) for (x,y),(a,b) in zip(points,points[1:])]
    return points[0]


class Stroke:
    def __init__(self,points):
        self.points=points
        self.derivative=[(b[0]-a[0],b[1]-a[1]) for a,b in zip(points,points[1:])]
        self.dist=[0.]
        last=points[0]
        for i in range(1,401):
            p=bezier(points,i/400)
            self.dist.append(self.dist[-1]+math.dist(last,p))
            last=p
        self.length=self.dist[-1]

    def sample(self,distance):
        i=max(0,min(399,bisect.bisect_right(self.dist,distance)-1))
        u=(i+(distance-self.dist[i])/(self.dist[i+1]-self.dist[i]))/400
        dx,dy=bezier(self.derivative,u)
        return *bezier(self.points,u),math.atan2(dy,dx)


b=.69
reach=3.8
fillet=.82
start=b+fillet
# Collinear endpoint handles make curvature vanish where the curves meet straights.
strokes=[
    Stroke([(-b,start),(-b,reach)]),
    Stroke([(-b,reach),(-b,reach+.48*b),(-b,reach+2.0*b),
            (b,reach+2.0*b),(b,reach+.48*b),(b,reach)]),
    Stroke([(b,reach),(b,start)]),
    Stroke([(b,start),(b,start-.33*fillet),(b,start-.79*fillet),
            (start-.79*fillet,b),(start-.33*fillet,b),(start,b)])
]
lengths=[strokes[i%4].length for i in range(16)]
avg=[l/(z-a) for l,a,z in zip(lengths,TIMES,TIMES[1:])]
# Monotone cubic distance law: neighbouring pieces agree on tangential speed.
speeds=[avg[0]]+[2*a*b/(a+b) for a,b in zip(avg,avg[1:])]+[0]


def pose(t):
    i=max(0,min(15,bisect.bisect_right(TIMES,t)-1))
    dt=TIMES[i+1]-TIMES[i]
    u=max(0,min(1,(t-TIMES[i])/dt))
    distance=lengths[i]*ease(u)+dt*u*(1-u)*((1-u)*speeds[i]-u*speeds[i+1])
    x,y,tangent=strokes[i%4].sample(distance)
    arm=i//4
    rotation=-math.pi/4-arm*math.pi/2
    x,y=x*math.cos(rotation)-y*math.sin(rotation),x*math.sin(rotation)+y*math.cos(rotation)
    phi=tangent+rotation
    # Unwrap the clockwise cap and counterclockwise waist into the same branch.
    if i%4==1 and tangent>math.pi/2+.01:
        phi-=2*math.pi
    yaw=phi
    if i==0:
        yaw=-math.pi/4
    elif i==1:
        relative=math.pi/2-tangent
        yaw=mix(-math.pi/4,phi+.47*ease(relative/math.pi),ease((relative-.32)/1.6))
    elif i==2:
        yaw=phi+.47
    elif i==3:
        yaw=phi+.47*(1-ease(u))
    elif i==9:
        yaw=phi-.53*ease(u)
    elif i==10:
        yaw=phi+mix(-.53,.53,ease(u))
    elif i==11:
        yaw=phi+.53*(1-ease(u))
    # Trace the planned curve with the fixed axle during an Ackermann turn.
    # The centre is L/2 ahead of the rear axle or L/2 behind the front axle.
    # Transfer the reference point on the straight approaches.
    offset=0
    if i==4: offset=.25*ease(u)
    if i==5: offset=.25
    if i==6: offset=mix(.25,-.25,ease(u))
    if i==7: offset=-.25
    if i==8: offset=-.25*(1-ease(u))
    return x+offset*math.cos(yaw),y+offset*math.sin(yaw),yaw


def build():
    origin=pose(0)
    count=int(END/STEP)+1
    poses=[]
    for k in range(count):
        t=k*STEP
        x,y,yaw=pose(min(t,ARRIVE))
        if t>ARRIVE:
            # Pivot through the short arc back to the initial heading.
            angle=math.remainder(origin[2]-yaw,2*math.pi)
            yaw+=angle*ease((t-79.35)/4.2)
        poses.append((x-origin[0],y-origin[1],yaw))
    last=[0]*4
    rolls=[0]*4
    prev_speed=[0]*4
    frames=[]
    pivot=[math.atan(-cx/cy) for cx,cy in CORNERS]
    for k,(x,y,yaw) in enumerate(poses):
        t=k*STEP
        a=poses[max(0,k-1)];b=poses[min(k+1,count-1)]
        dt=STEP*(1 if k in (0,count-1) else 2)
        dx,dy=(b[0]-a[0])/dt,(b[1]-a[1])/dt
        omega=math.remainder(b[2]-a[2],2*math.pi)/dt
        vx=dx*math.cos(yaw)+dy*math.sin(yaw)
        vy=-dx*math.sin(yaw)+dy*math.cos(yaw)
        wheels=[]
        for j,(cx,cy) in enumerate(CORNERS):
            wx,wy=vx-omega*cy,vy+omega*cx
            if ARRIVE<=t<=79.35:
                angle=pivot[j]*ease((t-ARRIVE)/1.35)
            elif math.hypot(wx,wy)<1e-7:
                angle=last[j]
            else:
                angle=math.atan2(wy,wx)
                if angle>math.pi/2+1e-8: angle-=math.pi
                if angle<-math.pi/2-1e-8: angle+=math.pi
            speed=wx*math.cos(angle)+wy*math.sin(angle)
            if k:
                assert abs(angle-last[j])<.06,(t,j,angle,last[j])
                rolls[j]+=(speed+prev_speed[j])*STEP/(2*.08)
            wheels.extend((angle,speed,rolls[j]))
            last[j],prev_speed[j]=angle,speed
        if k%10==0:
            frames.append([round(v,5) for v in (x,y,yaw,*wheels)])
    assert math.dist(poses[-1][:2],(0,0))<1e-8
    assert abs(math.remainder(poses[-1][2]-origin[2],2*math.pi))<1e-8
    data=',\n'.join(json.dumps(row,separators=(',',':')) for row in frames)
    target=Path(__file__).resolve().parents[1]/'assets/letter-data.js'
    target.write_text('// Generated by tools/build_letter.py. Same wheel order and units as route-data.js.\n'
                      + f'window.XmobotLetterSamples = {{fps:{FPS},rows:[\n{data}\n]}};\n')


if __name__=='__main__':
    build()
